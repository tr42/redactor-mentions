Getting Started
===============

#. Copy ``mentions.css`` and ``mentions.js`` somewhere into your assets directory.
#. Add them to your markup after redactor stuff::

    <link rel="stylesheet" href="js/redactor/redactor.css" />
    <link rel="stylesheet" href="js/redactor/mentions.css" />
    <script src="js/redactor/redactor.js"></script>
    <script src="js/redactor/mentions.js"></script>

#. Add the mention plugins to your initialization::

    $('.post').redactor({
        plugins: ['mentions'],
        usersUrl: "users.json", // user data for mentions plugin
        maxUsers: 5 // maximum users to show in user select dialog
    });

The users JSON data should look like::

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
