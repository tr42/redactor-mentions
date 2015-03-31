# grab global object
root = exports ? this

# grab jQuery/redactor globals
$ = root.jQuery
utils = root.RedactorUtils = root.RedactorUtils ? {}
plugins = root.RedactorPlugins = root.RedactorPlugins ? {}
users = null  # where we store all the user data


# extend utils with stuff that isn't concerned with redactor instance
$.extend utils, do ->
    # needed in other parts in utils
    once = (func) ->
        # only run func once even if it's called multiple times
        func._ran = false
        func._return = null
        ->
            if not func._ran
                func._ran = true
                func._return = func.apply this, arguments
            func._return
    once: once

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

    loadUsers: once (url) ->
        # async call to get user data and assign it into module global
        $.getJSON url, (data) ->
            users = data

            for user, i in data
                # create actual dom node for userSelect
                user.$element = $ """
                    <li class="user">
                        <img src="#{ user.icon }" />#{ user.username }  (#{ user.name })
                    </li>"""

                # put a pointer back to user object
                user.$element[0].user = user

    filterTest: (user, filter_string) ->
        # test if user passes through the filter given by filter_string
        filter_string = filter_string.toLowerCase()
        test_strings = [
            user.username.toLowerCase()
            user.name.toLowerCase()
        ]
        utils.any test_strings.map (el) ->
            el.indexOf(filter_string) != -1

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
        # test to see if the cursor is at a place where a mention can be inserted

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
        # slice off last two characters and test them
        left.slice(-2) in ['@', ' @']


# extend plugins with stuff that is concerned with redactor instance
plugins.mentions = ->
   #########
   # setup #
   #########

   init: ->
       this.mentions.select_state = null  # state of display of user select
       this.mentions.selected = null      # current user select index
       this.mentions.$userSelect = null   # user select element

       this.mentions.validateOptions()
       utils.loadUsers(this.opts.mentions.url)
       this.mentions.setupUserSelect()
       this.mentions.setupEditor()

   validateOptions: ->
       # make sure options are set to valid values
       required = [
           "url"
           "maxUsers"
       ]
       for name in required
           if not this.opts.mentions[name]
               throw "Mention plugin requires option: #{ name }"


   setupUserSelect: ->
       # init it's state to false
       this.mentions.select_state = false
       # create dom nodes
       this.mentions.$containerDiv = $ '<div class="redactor-mentions-container"></div>'
       # hide it by default
       this.mentions.$containerDiv.hide()

       this.mentions.$userSelect = $ '<ol class="redactor_ user-select"></ol>'
       this.mentions.$containerDiv.append this.mentions.$userSelect
       # setup event handlers
       this.mentions.$userSelect.mousemove $.proxy(this.mentions.selectMousemove, this)
       this.mentions.$userSelect.mousedown $.proxy(this.mentions.selectClick, this)
       # insert it into active dom tree
       this.$editor.after this.mentions.$containerDiv

   setupEditor: ->
       # setup event handlers
       this.$editor.on "keydown.mentions", $.proxy(this.mentions.editorKeydown, this)
       this.$editor.on "mousedown.mentions", $.proxy(this.mentions.selectClick, this)

   ##################
   # event handlers #
   ##################

   # select event handlers
   selectMousemove: (e) ->
       $target = $ e.target
       if $target.hasClass 'user'
           this.mentions.selected = this.mentions.$userSelect.children().index $target
           this.mentions.paintSelected()

   selectClick: (e) ->
       if this.mentions.select_state
           e.preventDefault()
           this.mentions.chooseUser()
           this.mentions.closeMention()
           this.mentions.setCursorAfterMention()
           this.mentions.disableSelect()

   # editor event handlers
   editorKeydown: (e) ->
       that = this

       if this.mentions.cursorInMention()
           switch e.which
               when 27  # escape
                   this.mentions.closeMention()
                   this.mentions.disableSelect()

               when 9, 13  # tab, return
                   e.preventDefault()

                   # work around to prevent tabs being inser
                   tabFocus = this.opts.tabFocus
                   this.opts.tabFocus = false

                   if this.mentions.select_state and this.mentions.$userSelect.children().length > 0
                       this.mentions.chooseUser()

                   this.mentions.closeMention()
                   this.mentions.setCursorAfterMention()
                   this.mentions.disableSelect()

                   # reset tabFocus when you return to the event loop
                   setTimeout ->
                       that.opts.tabFocus = tabFocus
                   , 0

               when 38  # up
                   e.preventDefault()
                   this.mentions.moveSelectUp()

               when 40  # down
                   e.preventDefault()
                   this.mentions.moveSelectDown()

       else if utils.cursorAfterMentionStart()
           utils.createMention()
           this.mentions.enableSelect()

       # after every key press, make sure that select state is correct
       setTimeout $.proxy(this.mentions.updateSelect, this), 0

   editorMousedown: ->
       # after every mousepress, make sure that select state is correct
       setTimeout $.proxy(this.mentions.updateSelect, this), 0

   ########################
   # select functionality #
   ########################

   positionContainerDiv: ->
       $firstNode = $ this.selection.getNodes()[0]
       boxOffset = this.$box.offset()
       nodeOffset = $firstNode.offset()
       this.mentions.$containerDiv.css(
           left: nodeOffset.left - boxOffset.left,
           top: nodeOffset.top - boxOffset.top + parseFloat($firstNode.css("line-height"))
       )

   updateSelect: ->
       if this.mentions.cursorInMention()
           this.mentions.filterUsers()
           this.mentions.positionContainerDiv()
           this.mentions.$containerDiv.show()
       else
           this.mentions.$containerDiv.hide()

   moveSelectUp: ->
       if this.mentions.selected > 0
           this.mentions.selected -= 1
       this.mentions.paintSelected()

   moveSelectDown: ->
       if this.mentions.selected < this.mentions.$userSelect.children().length - 1
           this.mentions.selected += 1
       this.mentions.paintSelected()

   enableSelect: ->
       this.mentions.select_state = true
       this.mentions.selected = 0

       # build initial user select
       for i in [0...this.opts.mentions.maxUsers]
           this.mentions.$userSelect.append users[i].$element

       this.mentions.paintSelected()
       this.mentions.positionContainerDiv()
       this.mentions.$containerDiv.show()

   disableSelect: ->
       this.mentions.select_state = false
       this.mentions.selected = null
       this.mentions.$userSelect.children().detach()
       this.mentions.$containerDiv.hide()

   paintSelected: ->
       $elements = $ 'li', this.mentions.$userSelect
       $elements.removeClass 'selected'
       $elements.eq(this.mentions.selected).addClass 'selected'

   chooseUser: ->
       user = this.mentions.userFromSelected()
       mention = this.mentions.getCurrentMention()
       prefix = this.opts.mentions.urlPrefix or '/user/'
       mention.attr "href", prefix + user.username
       mention.text "@#{ user.username }"

   userFromSelected: ->
       this.mentions.$userSelect.children('li')[this.mentions.selected].user

   filterUsers: ->
       # empty out userSelect
       this.mentions.$userSelect.children().detach()

       # query for filter_string once
       filter_string = this.mentions.getFilterString()

       # build filtered users list
       count = 0
       for user in users
           # break on max filter users
           break if count >= this.opts.mentions.maxUsers

           if utils.filterTest user, filter_string
               this.mentions.$userSelect.append user.$element
               count++

       this.mentions.paintSelected()

   getFilterString: ->
       mention = this.mentions.getCurrentMention()
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
       mention = this.mentions.getCurrentMention()
       mention.attr "contenteditable", "false"

   getCurrentMention: ->
       # return the current mention based on cursor position, if there
       # isn't one then return false

       # first check the current element, if it is a mention return it
       current = $ this.selection.getCurrent()
       return current if current.hasClass 'mention'

       # else select from parents
       parents = current.parents '.mention'
       return parents.eq 0 if parents.length > 0

       # throw if there isn't a current mention
       throw "There is no current mention."

   cursorInMention: ->
       try
           this.mentions.getCurrentMention().length > 0
       catch e
           return false if e == "There is no current mention."
           throw e
       true

   setCursorAfterMention: ->
       mention = this.mentions.getCurrentMention()

       # insert space after mention
       mention.after "\u00a0"

       # set cursor
       selection = window.getSelection()
       new_range = document.createRange()
       new_range.setStart mention[0].nextSibling, 1
       new_range.setEnd mention[0].nextSibling, 1
       selection.removeAllRanges()
       selection.addRange new_range
