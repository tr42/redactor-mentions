(function() {
  var $, plugins, ref, ref1, root, users, utils;

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  $ = root.jQuery;

  utils = root.RedactorUtils = (ref = root.RedactorUtils) != null ? ref : {};

  plugins = root.RedactorPlugins = (ref1 = root.RedactorPlugins) != null ? ref1 : {};

  users = null;

  $.extend(utils, (function() {
    var once;
    once = function(func) {
      func._ran = false;
      func._return = null;
      return function() {
        if (!func._ran) {
          func._ran = true;
          func._return = func.apply(this, arguments);
        }
        return func._return;
      };
    };
    return {
      once: once,
      any: function(arr) {
        var element, j, len;
        for (j = 0, len = arr.length; j < len; j++) {
          element = arr[j];
          if (element) {
            return true;
          }
        }
        return false;
      },
      deadLink: function(e) {
        return e.preventDefault();
      },
      getCursorInfo: function() {
        var range, selection;
        selection = window.getSelection();
        range = selection.getRangeAt(0);
        return {
          selection: selection,
          range: range,
          offset: range.startOffset,
          container: range.startContainer
        };
      },
      loadUsers: once(function(url) {
        return $.getJSON(url, function(data) {
          var i, j, len, results, user;
          users = data;
          results = [];
          for (i = j = 0, len = data.length; j < len; i = ++j) {
            user = data[i];
            user.$element = $("<li class=\"user\">\n    <img src=\"" + user.icon + "\" />" + user.username + "  (" + user.name + ")\n</li>");
            results.push(user.$element[0].user = user);
          }
          return results;
        });
      }),
      filterTest: function(user, filter_string) {
        var test_strings;
        filter_string = filter_string.toLowerCase();
        test_strings = [user.username.toLowerCase(), user.name.toLowerCase()];
        return utils.any(test_strings.map(function(el) {
          return el.indexOf(filter_string) !== -1;
        }));
      },
      createMention: function() {
        var cursor_info, left, mention, new_range, right;
        cursor_info = utils.getCursorInfo();
        mention = $('<a href="#" class="mention">@\u200b</a>');
        mention.click(utils.deadLink);
        left = cursor_info.container.data.slice(0, cursor_info.offset);
        right = cursor_info.container.data.slice(cursor_info.offset);
        left = left.slice(0, -1);
        cursor_info.container.data = left;
        mention.insertAfter(cursor_info.container);
        mention.after(right);
        new_range = document.createRange();
        new_range.setStart(mention[0].firstChild, 1);
        new_range.setEnd(mention[0].firstChild, 1);
        cursor_info.selection.removeAllRanges();
        return cursor_info.selection.addRange(new_range);
      },
      cursorAfterMentionStart: function() {
        var cursor_info, left, ref2;
        cursor_info = utils.getCursorInfo();
        if (cursor_info.container.nodeName !== "#text") {
          return false;
        }
        left = cursor_info.container.data.slice(0, cursor_info.offset);
        left = left.replace(/\u00a0/g, ' ');
        left = left.replace(/\u200b/g, '');
        return (ref2 = left.slice(-2)) === '@' || ref2 === ' @';
      }
    };
  })());

  plugins.mentions = function() {
    return {
      init: function() {
        this.mentions.select_state = null;
        this.mentions.selected = null;
        this.mentions.$userSelect = null;
        this.mentions.validateOptions();
        utils.loadUsers(this.opts.mentions.url);
        this.mentions.setupUserSelect();
        return this.mentions.setupEditor();
      },
      validateOptions: function() {
        var j, len, name, required, results;
        required = ["url", "maxUsers"];
        results = [];
        for (j = 0, len = required.length; j < len; j++) {
          name = required[j];
          if (!this.opts.mentions[name]) {
            throw "Mention plugin requires option: " + name;
          } else {
            results.push(void 0);
          }
        }
        return results;
      },
      setupUserSelect: function() {
        this.mentions.select_state = false;
        this.mentions.$containerDiv = $('<div class="redactor-mentions-container"></div>');
        this.mentions.$containerDiv.hide();
        this.mentions.$userSelect = $('<ol class="redactor_ user-select"></ol>');
        this.mentions.$containerDiv.append(this.mentions.$userSelect);
        this.mentions.$userSelect.mousemove($.proxy(this.mentions.selectMousemove, this));
        this.mentions.$userSelect.mousedown($.proxy(this.mentions.selectClick, this));
        return this.$editor.after(this.mentions.$containerDiv);
      },
      setupEditor: function() {
        this.$editor.on("keydown.mentions", $.proxy(this.mentions.editorKeydown, this));
        return this.$editor.on("mousedown.mentions", $.proxy(this.mentions.selectClick, this));
      },
      selectMousemove: function(e) {
        var $target;
        $target = $(e.target);
        if ($target.hasClass('user')) {
          this.mentions.selected = this.mentions.$userSelect.children().index($target);
          return this.mentions.paintSelected();
        }
      },
      selectClick: function(e) {
        if (this.mentions.select_state) {
          e.preventDefault();
          this.mentions.chooseUser();
          this.mentions.closeMention();
          this.mentions.setCursorAfterMention();
          return this.mentions.disableSelect();
        }
      },
      editorKeydown: function(e) {
        var tabFocus, that;
        that = this;
        if (this.mentions.cursorInMention()) {
          switch (e.which) {
            case 27:
              this.mentions.closeMention();
              this.mentions.disableSelect();
              break;
            case 9:
            case 13:
              e.preventDefault();
              tabFocus = this.opts.tabFocus;
              this.opts.tabFocus = false;
              if (this.mentions.select_state && this.mentions.$userSelect.children().length > 0) {
                this.mentions.chooseUser();
              }
              this.mentions.closeMention();
              this.mentions.setCursorAfterMention();
              this.mentions.disableSelect();
              setTimeout(function() {
                return that.opts.tabFocus = tabFocus;
              }, 0);
              break;
            case 38:
              e.preventDefault();
              this.mentions.moveSelectUp();
              break;
            case 40:
              e.preventDefault();
              this.mentions.moveSelectDown();
          }
        } else if (utils.cursorAfterMentionStart()) {
          utils.createMention();
          this.mentions.enableSelect();
        }
        return setTimeout($.proxy(this.mentions.updateSelect, this), 0);
      },
      editorMousedown: function() {
        return setTimeout($.proxy(this.mentions.updateSelect, this), 0);
      },
      positionContainerDiv: function() {
        var $firstNode, boxOffset, nodeOffset;
        $firstNode = $(this.selection.getNodes()[0]);
        boxOffset = this.$box.offset();
        nodeOffset = $firstNode.offset();
        return this.mentions.$containerDiv.css({
          left: nodeOffset.left - boxOffset.left,
          top: nodeOffset.top - boxOffset.top + parseFloat($firstNode.css("line-height"))
        });
      },
      updateSelect: function() {
        if (this.mentions.cursorInMention()) {
          this.mentions.filterUsers();
          this.mentions.positionContainerDiv();
          return this.mentions.$containerDiv.show();
        } else {
          return this.mentions.$containerDiv.hide();
        }
      },
      moveSelectUp: function() {
        if (this.mentions.selected > 0) {
          this.mentions.selected -= 1;
        }
        return this.mentions.paintSelected();
      },
      moveSelectDown: function() {
        if (this.mentions.selected < this.mentions.$userSelect.children().length - 1) {
          this.mentions.selected += 1;
        }
        return this.mentions.paintSelected();
      },
      enableSelect: function() {
        var i, j, ref2;
        this.mentions.select_state = true;
        this.mentions.selected = 0;
        for (i = j = 0, ref2 = this.opts.mentions.maxUsers; 0 <= ref2 ? j < ref2 : j > ref2; i = 0 <= ref2 ? ++j : --j) {
          this.mentions.$userSelect.append(users[i].$element);
        }
        this.mentions.paintSelected();
        this.mentions.positionContainerDiv();
        return this.mentions.$containerDiv.show();
      },
      disableSelect: function() {
        this.mentions.select_state = false;
        this.mentions.selected = null;
        this.mentions.$userSelect.children().detach();
        return this.mentions.$containerDiv.hide();
      },
      paintSelected: function() {
        var $elements;
        $elements = $('li', this.mentions.$userSelect);
        $elements.removeClass('selected');
        return $elements.eq(this.mentions.selected).addClass('selected');
      },
      chooseUser: function() {
        var mention, prefix, user;
        user = this.mentions.userFromSelected();
        mention = this.mentions.getCurrentMention();
        prefix = this.opts.mentions.urlPrefix || '/user/';
        mention.attr("href", prefix + user.username);
        return mention.text("@" + user.username);
      },
      userFromSelected: function() {
        return this.mentions.$userSelect.children('li')[this.mentions.selected].user;
      },
      filterUsers: function() {
        var count, filter_string, j, len, user;
        this.mentions.$userSelect.children().detach();
        filter_string = this.mentions.getFilterString();
        count = 0;
        for (j = 0, len = users.length; j < len; j++) {
          user = users[j];
          if (count >= this.opts.mentions.maxUsers) {
            break;
          }
          if (utils.filterTest(user, filter_string)) {
            this.mentions.$userSelect.append(user.$element);
            count++;
          }
        }
        return this.mentions.paintSelected();
      },
      getFilterString: function() {
        var filter_str, mention;
        mention = this.mentions.getCurrentMention();
        filter_str = mention.text();
        filter_str = filter_str.slice(1);
        filter_str = filter_str.replace(/\u00a0/g, ' ');
        return filter_str.replace(/\u200b/g, '');
      },
      closeMention: function() {
        var mention;
        mention = this.mentions.getCurrentMention();
        return mention.attr("contenteditable", "false");
      },
      getCurrentMention: function() {
        var current, parents;
        current = $(this.selection.getCurrent());
        if (current.hasClass('mention')) {
          return current;
        }
        parents = current.parents('.mention');
        if (parents.length > 0) {
          return parents.eq(0);
        }
        throw "There is no current mention.";
      },
      cursorInMention: function() {
        var e;
        try {
          this.mentions.getCurrentMention().length > 0;
        } catch (_error) {
          e = _error;
          if (e === "There is no current mention.") {
            return false;
          }
          throw e;
        }
        return true;
      },
      setCursorAfterMention: function() {
        var mention, new_range, selection;
        mention = this.mentions.getCurrentMention();
        mention.after("\u00a0");
        selection = window.getSelection();
        new_range = document.createRange();
        new_range.setStart(mention[0].nextSibling, 1);
        new_range.setEnd(mention[0].nextSibling, 1);
        selection.removeAllRanges();
        return selection.addRange(new_range);
      }
    };
  };

}).call(this);
