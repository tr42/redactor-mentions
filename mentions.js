var RedactorPlugins, RedactorUtils;

RedactorUtils = (function () {
    return {
        getCursorInfo: function () {
            var selection, range, container, offset;

            selection = window.getSelection();
            range = selection.getRangeAt(0);
            offset = range.startOffset;
            container = range.startContainer;

            return {
                selection: selection,
                range: range,
                offset: offset,
                container: container
            };
        },
        any: function (arr) {
            var i;

            for (i = 0; i < arr.length; i++) {
                if (arr[i]) {
                    return true;
                }
            }
            return false;
        }
    };
})();

RedactorPlugins = (function (plugins, utils) {
    function update_select() {
        if (this.cursorInMention()) {
            this.filterUsers();
            this.$userSelect.show();
        } else {
            this.$userSelect.hide();
        }
    }
    plugins.mentions = {
        // setup
        init: function () {
            this.users = null; // array of user information
            this.select_state = null; // state of display of user select
            this.selected = null; // current user select index
            this.$userSelect = null; // user select element

            this.loadUsers();
            this.setupUserSelect();
            this.$editor.keydown($.proxy(this.editorKeydown, this));
            this.$editor.mousedown($.proxy(this.editorMousedown, this));
        },
        loadUsers: function () {
            var that, url;

            that = this;
            url = this.opts.usersUrl;
            this.users = [];

            $.getJSON(url, function (data) {
                var i, user;

                that.users = data;
                for (i = 0; i < that.users.length; i++) {
                    user = that.users[i];
                    user.$element = $('<li class="user"><img src="' + user.icon + '" />' + user.username + ' (' + user.name + ')</li>');
                    user.$element.data('username', user.username);
                }
            });
        },
        setupUserSelect: function () {
            this.select_state = false;
            this.$userSelect = $('<ol class="redactor_ user_select"></ol>');
            this.$userSelect.mousemove($.proxy(this.selectMousemove, this));
            this.$userSelect.mousedown($.proxy(this.selectMousedown, this));
            this.$editor.after(this.$userSelect);
        },

        // select event handlers
        selectMousemove: function (e) {
            var $target;

            $target = $(e.target);
            if ($target.hasClass('user')) {
                this.selected = this.$userSelect.children().index($target);
                this.paintSelected();
            }
        },
        selectMousedown: function (e) {
            if (this.select_state) {
                e.preventDefault();
                this.chooseUser();
                this.closeMention();
                this.setCursorAfterMention();
                this.disableSelect();
            }
        },

        // editor event handlers
        editorKeydown: function (e) {
            var that, tabFocus;

            that = this;

            if (this.cursorInMention()) {
                switch (e.keyCode) {
                    case 27: // escape
                    case 32: // space
                        this.closeMention();
                        this.disableSelect();
                        break;
                    case 9: // tab
                    case 13: // return
                        e.preventDefault();

                        // work around to prevent tabs being inserted
                        tabFocus = this.opts.tabFocus;
                        this.opts.tabFocus = false;

                        this.chooseUser();
                        this.closeMention();
                        this.setCursorAfterMention();
                        this.disableSelect();

                        // reset tabFocus when you return to the event loop
                        setTimeout(function () {
                            that.opts.tabFocus = tabFocus;
                        }, 0);
                        break;
                    case 38: // up
                        e.preventDefault();
                        this.moveSelectUp();
                        break;
                    case 40: // down
                        e.preventDefault();
                        this.moveSelectDown();
                        break;
                }
            } else if (this.cursorAfterMentionStart()) {
                this.createMention();
                this.enableSelect();
            } 
            // after every key press, make sure that select state is correct
            setTimeout($.proxy(update_select, this), 0);
        },
        editorMousedown: function () {
            // after every mousepress, make sure that select state is correct
            setTimeout($.proxy(update_select, this), 0);
        },

        // select navigation
        moveSelectUp: function () {
            if (this.selected > 0) {
                this.selected -= 1;
            }
            this.paintSelected();
        },
        moveSelectDown: function () {
            if (this.selected < this.$userSelect.children().length - 1) {
                this.selected += 1;
            }
            this.paintSelected();
        },

        // select state
        enableSelect: function () {
            var i;

            this.select_state = true;
            this.selected = 0;

            // build initial user select
            for (i = 0; i < 6; i++) {
                this.$userSelect.append(this.users[i].$element);
            }
            this.paintSelected();
            this.$userSelect.show();
        },
        disableSelect: function () {
            this.select_state = false;
            this.selected = null;
            this.$userSelect.children().detach();
            this.$userSelect.hide();
        },

        // select display
        paintSelected: function () {
            var $elements;

            $elements = $('li', this.$userSelect);
            $elements.removeClass('selected');
            $elements.eq(this.selected).addClass('selected');
        },

        // select utils
        chooseUser: function () {
            var username, mention;

            username = this.$userSelect.children().eq(this.selected).data('username');
            mention = this.getCurrentMention();
            mention.attr("href", "/user/" + username);
            mention.text("@" + username);
        },
        filterUsers: function () {
            var i, user, filter_string;

            // empty out userSelect
            this.$userSelect.children().detach();

            // query for filter_string once
            filter_string = this.getFilterString();

            // build filtered users list
            for (i = 0; i < this.users.length; i++) {
                user = this.users[i];
                if (this.filterTest(user, filter_string)) {
                    this.$userSelect.append(user.$element);
                }
                // break on max filter users
                if (this.opts.maxUsers && this.$userSelect.children().length >= this.opts.maxUsers) {
                    break;
                }
            }
            this.paintSelected();
        },
        filterTest: function (user, filter_string) {
            var test_strings;

            filter_string = filter_string.toLowerCase();
            test_strings = [
                user.username.toLowerCase(),
                user.name.toLowerCase()
            ];
            return utils.any(test_strings.map(function (el) {
                return el.indexOf(filter_string) !== -1;
            }));
        },
        getFilterString: function () {
            var mention, filter_str;

            mention = this.getCurrentMention();
            filter_str = mention.text();
            // remove @ from the begining
            filter_str = filter_str.slice(1);
            // remove zero width spaces
            filter_str = filter_str.replace(/\u200B/g, '');
            return filter_str;
        },

        // mention
        createMention: function () {
            var mention, cursor_info, left, right, new_range;

            cursor_info = utils.getCursorInfo();
            mention = $('<a href="#" class="mention">@\u200b</a>');

            // make sure mention links aren't clickable
            mention.click(function (e) {
                e.preventDefault();
            });

            // insert mention where cursor is at
            // figure out what text is left and right of the cursor
            left = cursor_info.container.data.slice(0, cursor_info.offset);
            right = cursor_info.container.data.slice(cursor_info.offset);

            // slice off the @ sign
            left = left.slice(0, -1);

            // insert the mention inbetween left and right
            cursor_info.container.data = left;
            mention.insertAfter(cursor_info.container);
            mention.after(right);

            // set cursor positon into mention
            new_range = document.createRange();
            new_range.setStart(mention[0].firstChild, 1);
            new_range.setEnd(mention[0].firstChild, 1);
            cursor_info.selection.removeAllRanges();
            cursor_info.selection.addRange(new_range);
        },
        closeMention: function () {
            var mention;

            mention = this.getCurrentMention();
            mention.attr("contenteditable", "false");
        },

        // helpers
        getCurrentMention: function () {
            // return the current mention based on cursor position, if there
            // isn't one then return false
            var current, parents;

            // first check the current element, if it is a mention return it
            current = $(this.getCurrent());
            if (current.hasClass('mention')) {
                return current;
            }

            // else select from parents
            parents = current.parents('.mention');
            if (parents.length > 0) {
                return parents.eq(0);
            }

            return false;
        },
        cursorInMention: function () {
            return this.getCurrentMention().length > 0;
        },
        cursorAfterMentionStart: function () {
            var matches, cursor_info, left, previous_chars;

            matches = [
                "@",
                " @",
                "\u200b@",
                "@\u200B"
            ];

            // get cursor element and offset
            cursor_info = utils.getCursorInfo();

            // if cursor isn't on a text element return false
            if (cursor_info.container.nodeName !== "#text") {
                return false;
            }

            // figure out what is left of the cursor
            left = cursor_info.container.data.slice(0, cursor_info.offset);
            previous_chars = left.slice(-2);

            return utils.any(matches.map(function (el) {
                return el === previous_chars;
            }));
        },
        setCursorAfterMention: function () {
            var mention, selection, new_range;

            mention = this.getCurrentMention();

            // insert space after mention
            mention.after(" ");

            // set cursor
            selection = window.getSelection();
            new_range = document.createRange();
            new_range.setStart(mention[0].nextSibling, 1);
            new_range.setEnd(mention[0].nextSibling, 1);
            selection.removeAllRanges();
            selection.addRange(new_range);
        }
    };
    return plugins;
})(typeof RedactorPlugins !== "undefined" ? RedactorPlugins : {}, RedactorUtils);
