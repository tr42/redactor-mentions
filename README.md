# Overview

Updated version of [redactor-mentions](https://github.com/tr42/redactor-mentions) plugin that supports [Redactor 10](http://imperavi.com/redactor/) and some enhancements (like floating div by the underneath the cursor).  My goal is to eventually support searching through AJAX URLs.  This is currently a work in progress.

Note that this project is under heavy development so no guarantees that it will work for you yet.

# Installation

## Manual

Copy `redactor-mentions.min.css` and `redactor-mentions.min.js` from the `dist` folder. Include `jquery.ba-throttle-debounce.min.js` if using the server side searching functionality.

## Bower

I am just getting started with this so I haven't published to bower yet.  I will do that soon.

# Usage

1. Copy `redactor-mentions.min.css` and `redactor-mentions.min.js` somewhere in your assets directory.

2. Add them to your markup after redactor stuff. Note that if you are using the server side searching functionality then you also need to include `jquery.ba-throttle-debounce.min.js`.

```html
<link rel="stylesheet" href="js/redactor/redactor.css" />
<link rel="stylesheet" href="js/redactor/redactor-mentions.min.css" />
<script src="js/redactor/redactor.js"></script>
<script src="js/redactor/redactor-mentions.min.js"></script>

<!-- Include this if using server side searching functionality. -->
<script src="js/jquery.ba-throttle-debounce.min.js"></script>
```

3. Add the mention plugins to your initialization:

```javascript
$('.post').redactor({
	plugins: ['mentions'],
    mentions {
        url: "users.json",   // user data for mentions plugin
        maxUsers: 5,         // maximum users to show in user select dialog
        urlPrefix: "/user/", // optional url prefix for user
        
        // Optional.  Pass in a function to format each user li.  This should return
        // a jQuery object.
        userFormatFunction: function(user) {
            return $("""
            <li class="user">
                <img src="#{ user.icon }" />#{ user.username }  (#{ user.name })
            </li>""");
        }
    }
});
```

The users JSON data should look like:

```javascript
[
    {
        "icon": "/icons/bob.gif",
        "name": "Bob",
        "username": "bob"
    },
    {
        "icon": "/icons/alice.gif",
        "name": "Alice",
        "username": "alice"
    }
]
```
