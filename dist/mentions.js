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

$.extend(plugins, (function() {
  return {
    mentions: {
      init: function() {
        this.select_state = null;
        this.selected = null;
        this.$userSelect = null;
        this.validateOptions();
        utils.loadUsers(this.opts.usersUrl);
        this.setupUserSelect();
        return this.setupEditor();
      },
      validateOptions: function() {
        var j, len, name, required, results;
        required = ["usersUrl", "maxUsers"];
        results = [];
        for (j = 0, len = required.length; j < len; j++) {
          name = required[j];
          if (!this.opts[name]) {
            throw "Mention plugin requires option: " + name;
          } else {
            results.push(void 0);
          }
        }
        return results;
      },
      setupUserSelect: function() {
        this.select_state = false;
        this.$userSelect = $('<ol class="redactor_ user_select"></ol>');
        this.$userSelect.hide();
        this.$userSelect.mousemove($.proxy(this.selectMousemove, this));
        this.$userSelect.mousedown($.proxy(this.selectMousedown, this));
        return this.$editor.after(this.$userSelect);
      },
      setupEditor: function() {
        this.$editor.keydown($.proxy(this.editorKeydown, this));
        return this.$editor.mousedown($.proxy(this.editorMousedown, this));
      },
      selectMousemove: function(e) {
        var $target;
        $target = $(e.target);
        if ($target.hasClass('user')) {
          this.selected = this.$userSelect.children().index($target);
          return this.paintSelected();
        }
      },
      selectMousedown: function(e) {
        if (this.select_state) {
          e.preventDefault();
          this.chooseUser();
          this.closeMention();
          this.setCursorAfterMention();
          return this.disableSelect();
        }
      },
      editorKeydown: function(e) {
        var tabFocus, that;
        that = this;
        if (this.cursorInMention()) {
          switch (e.keyCode) {
            case 27:
              this.closeMention();
              this.disableSelect();
              break;
            case 9:
            case 13:
              e.preventDefault();
              tabFocus = this.opts.tabFocus;
              this.opts.tabFocus = false;
              if (this.select_state && this.$userSelect.children().length > 0) {
                this.chooseUser();
              }
              this.closeMention();
              this.setCursorAfterMention();
              this.disableSelect();
              setTimeout(function() {
                return that.opts.tabFocus = tabFocus;
              }, 0);
              break;
            case 38:
              e.preventDefault();
              this.moveSelectUp();
              break;
            case 40:
              e.preventDefault();
              this.moveSelectDown();
          }
        } else if (utils.cursorAfterMentionStart()) {
          utils.createMention();
          this.enableSelect();
        }
        return setTimeout($.proxy(this.updateSelect, this), 0);
      },
      editorMousedown: function() {
        return setTimeout($.proxy(this.updateSelect, this), 0);
      },
      updateSelect: function() {
        if (this.cursorInMention()) {
          this.filterUsers();
          return this.$userSelect.show();
        } else {
          return this.$userSelect.hide();
        }
      },
      moveSelectUp: function() {
        if (this.selected > 0) {
          this.selected -= 1;
        }
        return this.paintSelected();
      },
      moveSelectDown: function() {
        if (this.selected < this.$userSelect.children().length - 1) {
          this.selected += 1;
        }
        return this.paintSelected();
      },
      enableSelect: function() {
        var i, j, ref2;
        this.select_state = true;
        this.selected = 0;
        for (i = j = 0, ref2 = this.opts.maxUsers; 0 <= ref2 ? j < ref2 : j > ref2; i = 0 <= ref2 ? ++j : --j) {
          this.$userSelect.append(users[i].$element);
        }
        this.paintSelected();
        return this.$userSelect.show();
      },
      disableSelect: function() {
        this.select_state = false;
        this.selected = null;
        this.$userSelect.children().detach();
        return this.$userSelect.hide();
      },
      paintSelected: function() {
        var $elements;
        $elements = $('li', this.$userSelect);
        $elements.removeClass('selected');
        return $elements.eq(this.selected).addClass('selected');
      },
      chooseUser: function() {
        var mention, prefix, user;
        user = this.userFromSelected();
        mention = this.getCurrentMention();
        prefix = this.opts.userUrlPrefix || '/user/';
        mention.attr("href", prefix + user.username);
        return mention.text("@" + user.username);
      },
      userFromSelected: function() {
        return this.$userSelect.children('li')[this.selected].user;
      },
      filterUsers: function() {
        var count, filter_string, j, len, user;
        this.$userSelect.children().detach();
        filter_string = this.getFilterString();
        count = 0;
        for (j = 0, len = users.length; j < len; j++) {
          user = users[j];
          if (count >= this.opts.maxUsers) {
            break;
          }
          if (utils.filterTest(user, filter_string)) {
            this.$userSelect.append(user.$element);
            count++;
          }
        }
        return this.paintSelected();
      },
      getFilterString: function() {
        var filter_str, mention;
        mention = this.getCurrentMention();
        filter_str = mention.text();
        filter_str = filter_str.slice(1);
        filter_str = filter_str.replace(/\u00a0/g, ' ');
        return filter_str.replace(/\u200b/g, '');
      },
      closeMention: function() {
        var mention;
        mention = this.getCurrentMention();
        return mention.attr("contenteditable", "false");
      },
      getCurrentMention: function() {
        var current, parents;
        current = $(this.getCurrent());
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
          this.getCurrentMention().length > 0;
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
        mention = this.getCurrentMention();
        mention.after("\u00a0");
        selection = window.getSelection();
        new_range = document.createRange();
        new_range.setStart(mention[0].nextSibling, 1);
        new_range.setEnd(mention[0].nextSibling, 1);
        selection.removeAllRanges();
        return selection.addRange(new_range);
      }
    }
  };
})());
