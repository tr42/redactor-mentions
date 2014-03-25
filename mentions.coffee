# grab global object
root = exports ? this

# grab jQuery/redactor globals
$ = root.jQuery
utils = root.RedactorUtils = root.RedactorUtils ? {}
plugins = root.RedactorPlugins = root.RedactorPlugins ? {}
users = null

single_run = (func) ->
    # only run once
    func._has_ran = false
    func._return_value = null
    ->
        if not func._has_ran
            func._has_ran = true
            func._return_value = func.apply this, arguments
        func._return_value

load_users = single_run (url) ->
    # async call to get user data
    $.getJSON url, (data) ->
        users = data

        for user, i in data
            # create actual dom node for userSelect
            user.$element = $ """
                <li class="user">
                    <img src="#{ user.icon }" />#{ user.username }  (#{ user.name })
                </li>"""

            # put a pointer pointer back to user object
            # TODO: perhaps just make this a normal reference
            user.$element.data 'index', i

# extend utils with stuff that isn't concerned with redactor instance
$.extend utils, do ->
    any: (arr) ->
        # if any elements of arr are truthy then return true, else false
        for element in arr
            return true if element
        false

    deadLink: (e) ->
        # event handler to kill a link (prevent event from propagating)
        e.preventDefault()

    getCursorInfo: ->
        # return current cursor information
        selection = window.getSelection()
        range = selection.getRangeAt 0
        selection: selection
        range: range
        offset: range.startOffset
        container: range.startContainer

    filterTest: (user, filter_string) ->
        # test if user passes through the filter given by filter_string
        filter_string = filter_string.toLowerCase()
        test_strings = [
            user.username.toLowerCase()
            user.name.toLowerCase()
        ]
        utils.any(test_strings.map((el) ->
            el.indexOf(filter_string) != -1
        ))

    createMention: ->
        # create a new mention and insert it at cursor position
        cursor_info = utils.getCursorInfo()
        mention = $ '<a href="#" class="mention">@\u200b</a>'

        # make sure mention links aren't clickable
        mention.click utils.deadLink

        # insert mention where cursor is at
        # figure out what text is left and right of the cursor
        left = cursor_info.container.data.slice 0, cursor_info.offset
        right = cursor_info.container.data.slice cursor_info.offset

        # slice off the @ sign
        left = left.slice 0, -1

        # insert the mention inbetween left and right
        cursor_info.container.data = left
        mention.insertAfter cursor_info.container
        mention.after right

        # set cursor positon into mention
        new_range = document.createRange()
        new_range.setStart mention[0].firstChild, 1
        new_range.setEnd mention[0].firstChild, 1
        cursor_info.selection.removeAllRanges()
        cursor_info.selection.addRange new_range

    cursorAfterMentionStart: ->
        # test to see if the cursor is after a place where a mention can be
        # inserted at

        # get cursor element and offset
        cursor_info = utils.getCursorInfo()

        # if cursor isn't on a text element return false
        return false if cursor_info.container.nodeName != "#text"

        # figure out what is left of the cursor
        left = cursor_info.container.data.slice 0, cursor_info.offset
        # replace A0 with 20
        left = left.replace /\u00a0/g, ' '
        # remove zero width spaces
        left = left.replace /\u200b/g, ''

        previous_chars = left.slice -2
        previous_chars in [
            '@'
            ' @'
        ]

# extend plugins with stuff that is concerned with redactor instance
$.extend plugins, do ->
    mentions:

        #########
        # setup #
        #########

        init: ->
            this.select_state = null  # state of display of user select
            this.selected = null      # current user select index
            this.$userSelect = null   # user select element

            this.validateOptions()
            load_users(this.opts.usersUrl)
            this.setupUserSelect()
            this.setupEditor()

        validateOptions: ->
            # make sure options are set to valid values
            required = [
                "usersUrl"
                "maxUsers"
            ]
            for name in required
                if not this.opts[name]
                    throw "Mention plugin requires option: #{ name }"


        setupUserSelect: ->
            # init it's state to false
            this.select_state = false
            # create dom node
            this.$userSelect = $ '<ol class="redactor_ user_select"></ol>'
            # hide it by default
            this.$userSelect.hide()
            # setup event handlers
            this.$userSelect.mousemove $.proxy(this.selectMousemove, this)
            this.$userSelect.mousedown $.proxy(this.selectMousedown, this)
            # insert it into active dom tree
            this.$editor.after this.$userSelect

        setupEditor: ->
            # setup event handlers
            this.$editor.keydown $.proxy(this.editorKeydown, this)
            this.$editor.mousedown $.proxy(this.editorMousedown, this)

        ##################
        # event handlers #
        ##################

        # select event handlers
        selectMousemove: (e) ->
            $target = $ e.target
            if $target.hasClass 'user'
                this.selected = this.$userSelect.children().index $target
                this.paintSelected()

        selectMousedown: (e) ->
            if this.select_state
                e.preventDefault()
                this.chooseUser()
                this.closeMention()
                this.setCursorAfterMention()
                this.disableSelect()

        # editor event handlers
        editorKeydown: (e) ->
            that = this

            if this.cursorInMention()
                switch e.keyCode
                    when 27  # escape
                        this.closeMention()
                        this.disableSelect()

                    when 9, 13  # tab, return
                        e.preventDefault()

                        # work around to prevent tabs being inser
                        tabFocus = this.opts.tabFocus
                        this.opts.tabFocus = false

                        if this.select_state and this.$userSelect.children().length > 0
                            this.chooseUser()

                        this.closeMention()
                        this.setCursorAfterMention()
                        this.disableSelect()

                        # reset tabFocus when you return to the event loop
                        setTimeout ->
                            that.opts.tabFocus = tabFocus
                        , 0

                    when 38  # up
                        e.preventDefault()
                        this.moveSelectUp()

                    when 40  # down
                        e.preventDefault()
                        this.moveSelectDown()

            else if utils.cursorAfterMentionStart()
                utils.createMention()
                this.enableSelect()

            # after every key press, make sure that select state is correct
            setTimeout $.proxy(this.updateSelect, this), 0

        editorMousedown: ->
            # after every mousepress, make sure that select state is correct
            setTimeout $.proxy(this.updateSelect, this), 0

        ########################
        # select functionality #
        ########################

        updateSelect: ->
            if this.cursorInMention()
                this.filterUsers()
                this.$userSelect.show()
            else
                this.$userSelect.hide()

        moveSelectUp: ->
            if this.selected > 0
                this.selected -= 1
            this.paintSelected()

        moveSelectDown: ->
            if this.selected < this.$userSelect.children().length - 1
                this.selected += 1
            this.paintSelected()

        enableSelect: ->
            this.select_state = true
            this.selected = 0

            # build initial user select
            for i in [0...this.opts.maxUsers]
                this.$userSelect.append users[i].$element

            this.paintSelected()
            this.$userSelect.show()

        disableSelect: ->
            this.select_state = false
            this.selected = null
            this.$userSelect.children().detach()
            this.$userSelect.hide()

        paintSelected: ->
            $elements = $ 'li', this.$userSelect
            $elements.removeClass 'selected'
            $elements.eq(this.selected).addClass 'selected'

        chooseUser: ->
            user = this.userFromSelected()
            mention = this.getCurrentMention()
            mention.attr "href", "/user/#{ user.username }"
            mention.text "@#{ user.username }"

        userFromSelected: ->
            i = this.$userSelect.children('li').eq(this.selected).data 'index'
            if i == null or i == undefined or i < 0 or i >= users.length
                throw "index #{ i } out of bounds of user array #{ users.length }"
            users[i]

        filterUsers: ->
            # empty out userSelect
            this.$userSelect.children().detach()

            # query for filter_string once
            filter_string = this.getFilterString()

            # build filtered users list
            count = 0
            for user in users
                # break on max filter users
                break if count >= this.opts.maxUsers

                if utils.filterTest user, filter_string
                    this.$userSelect.append user.$element
                    count++

            this.paintSelected()

        getFilterString: ->
            mention = this.getCurrentMention()
            filter_str = mention.text()
            # remove @ from the begining
            filter_str = filter_str.slice 1
            # replace A0 with 20
            filter_str = filter_str.replace /\u00a0/g, ' '
            # remove zero width spaces
            filter_str.replace /\u200b/g, ''

        #########################
        # mention functionality #
        #########################

        closeMention: ->
            mention = this.getCurrentMention()
            mention.attr "contenteditable", "false"

        getCurrentMention: ->
            # return the current mention based on cursor position, if there
            # isn't one then return false

            # first check the current element, if it is a mention return it
            current = $ this.getCurrent()
            return current if current.hasClass 'mention'

            # else select from parents
            parents = current.parents '.mention'
            return parents.eq 0 if parents.length > 0

            # throw if there isn't a current mention
            throw "There is no current mention."

        cursorInMention: ->
            try
                this.getCurrentMention().length > 0
            catch e
                return false if e == "There is no current mention."
                throw e
            true

        setCursorAfterMention: ->
            mention = this.getCurrentMention()

            # insert space after mention
            mention.after "\u00a0"

            # set cursor
            selection = window.getSelection()
            new_range = document.createRange()
            new_range.setStart mention[0].nextSibling, 1
            new_range.setEnd mention[0].nextSibling, 1
            selection.removeAllRanges()
            selection.addRange new_range
