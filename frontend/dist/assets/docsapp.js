"use strict";
/* jshint ignore:start */

/* jshint ignore:end */

define('docsapp/app', ['exports', 'ember', 'ember/resolver', 'ember/load-initializers', 'docsapp/config/environment'], function (exports, _ember, _emberResolver, _emberLoadInitializers, _docsappConfigEnvironment) {

  var App = undefined;

  _ember['default'].MODEL_FACTORY_INJECTIONS = true;

  App = _ember['default'].Application.extend({
    modulePrefix: _docsappConfigEnvironment['default'].modulePrefix,
    podModulePrefix: _docsappConfigEnvironment['default'].podModulePrefix,
    Resolver: _emberResolver['default']
  });

  (0, _emberLoadInitializers['default'])(App, _docsappConfigEnvironment['default'].modulePrefix);

  exports['default'] = App;
});
define('docsapp/components/app-version', ['exports', 'ember-cli-app-version/components/app-version', 'docsapp/config/environment'], function (exports, _emberCliAppVersionComponentsAppVersion, _docsappConfigEnvironment) {

  var name = _docsappConfigEnvironment['default'].APP.name;
  var version = _docsappConfigEnvironment['default'].APP.version;

  exports['default'] = _emberCliAppVersionComponentsAppVersion['default'].extend({
    version: version,
    name: name
  });
});
define('docsapp/controllers/array', ['exports', '@ember/controller'], function (exports, _emberController) {
  exports['default'] = _emberController['default'];
});
define('docsapp/controllers/dashboard', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    isProfilePopupVisible: false,
    username: null,
    email: null,
    userDocuments: [],
    searchQuery: '',

    filteredDocuments: _ember['default'].computed('userDocuments.[]', 'searchQuery', function () {
      var searchQuery = this.get('searchQuery').toLowerCase();
      var userDocuments = this.get('userDocuments');

      if (!searchQuery) {
        return userDocuments;
      }

      return userDocuments.filter(function (doc) {
        return doc.title.toLowerCase().includes(searchQuery);
      });
    }),

    init: function init() {
      var _this = this;

      this._super.apply(this, arguments);
      this.validateSession();

      setInterval(function () {
        if (_this.username) {
          _this.loadUserDocuments(_this.username);
        }
      }, 5000);
    },

    validateSession: function validateSession() {
      var _this2 = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
        type: 'GET',
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this2.setProperties({
              username: response.username,
              email: response.email
            });

            if (!sessionStorage.getItem('dashboardReloaded')) {
              sessionStorage.setItem('dashboardReloaded', 'true');
              location.reload();
            }

            _this2.loadUserDocuments(response.username);
          } else {
            _this2.transitionToRoute('login');
          }
        },
        error: function error() {
          _this2.transitionToRoute('login');
        }
      });
    },

    loadUserDocuments: function loadUserDocuments() {
      var _this3 = this;

      var email = this.get('email');

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetUserDocumentsServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: email }),
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          _this3.set('userDocuments', response.documents);
        },
        error: function error() {
          alert("Error fetching user documents.");
        }
      });
    },

    actions: {
      toggleProfilePopup: function toggleProfilePopup() {
        this.toggleProperty('isProfilePopupVisible');
      },
      logout: function logout() {
        var _this4 = this;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/LogoutServlet',
          type: 'POST',
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            sessionStorage.removeItem('dashboardReloaded');
            _this4.transitionToRoute('login');
          },
          error: function error() {
            _this4.transitionToRoute('login');
          }
        });
      },
      createDocument: function createDocument() {
        var uniqueId = this.generateUniqueId();
        var email = this.get('email');
        var url = '/document/' + uniqueId;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SaveDocumentServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ email: email, uniqueId: uniqueId }),
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            window.open(url, '_blank');
          },
          error: function error() {
            alert("Error saving document.");
          }
        });
      },
      openDocument: function openDocument(uniqueId) {
        var url = '/document/' + uniqueId;
        window.open(url, '_blank');
      },
      updateSearchQuery: function updateSearchQuery(query) {
        this.set('searchQuery', query);
      }
    },

    generateUniqueId: function generateUniqueId() {
      var uuid = undefined;

      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        uuid = window.crypto.randomUUID();
      } else {
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : r & 0x3 | 0x8;
          return v.toString(16);
        });
      }

      var timestamp = Date.now().toString(36);
      return uuid + '-' + timestamp;
    }
  });
});
/* globals alert,setInterval,sessionStorage */
define('docsapp/controllers/document', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    documentId: null,
    updatedTitle: null,
    documentTitle: null,
    allUsers: [],
    filteredUsers: [],
    loggedInUserEmail: null,
    documentContent: null,
    socket: null,
    isViewer: false,
    isOwnerOrEditor: false,
    lastUpdatedMessage: null,
    isFavorited: false,
    lastSavedContent: null,

    init: function init() {
      var _this = this;

      this._super.apply(this, arguments);

      this.validateSession().then(function () {
        _ember['default'].run.next(_this, function () {
          var _this2 = this;

          var documentId = this.get('model.document_id');
          this.set('documentId', documentId);
          this.checkDocumentExists(documentId).then(function (exists) {
            if (exists) {
              _this2.loadDocumentDetails(documentId);
              _this2.fetchAllUsers();
              _this2.initWebSocket(documentId);
              _this2.checkIfFavorited(documentId);
            } else {
              console.log("Document does not exist.");
            }
          });
        });
      })['catch'](function (error) {
        console.error("Error during session validation:", error);
      });
    },

    checkIfFavorited: function checkIfFavorited(documentId) {
      var _this3 = this;

      var loggedInUserEmail = this.get('loggedInUserEmail');
      if (!loggedInUserEmail) {
        console.error("Logged in user email is not set.");
        return;
      }

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/CheckFavouriteServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ uniqueId: documentId, email: loggedInUserEmail }),
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status === "success") {
            _this3.set('isFavorited', response.isFavorited);
          } else {
            console.warn("Failed to check favorite status:", response.message);
          }
        },
        error: function error(xhr, status, _error) {
          console.error("AJAX Error:", status, _error);
        }
      });
    },

    toggleFavorite: function toggleFavorite() {
      var _this4 = this;

      var documentId = this.get('documentId');
      var loggedInUserEmail = this.get('loggedInUserEmail');
      var isFavorited = this.get('isFavorited');

      if (!documentId || !loggedInUserEmail) {
        console.error("Document ID or logged in user email is not set.");
        return;
      }

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/ToggleFavouriteServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ uniqueId: documentId, email: loggedInUserEmail, isFavorited: !isFavorited }),
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status === "success") {
            _this4.set('isFavorited', !isFavorited);
          } else {
            console.warn("Failed to toggle favorite status:", response.message);
          }
        },
        error: function error(xhr, status, _error2) {
          console.error("AJAX Error:", status, _error2);
        }
      });
    },

    checkDocumentExists: function checkDocumentExists(documentId) {
      var _this5 = this;

      return new Promise(function (resolve) {
        var loggedInUserEmail = _this5.get('loggedInUserEmail');
        if (!loggedInUserEmail) {
          console.error("Logged in user email is not set.");
          resolve(false);
          return;
        }

        var requestData = {
          uniqueId: documentId,
          email: loggedInUserEmail
        };

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/GetDocumentDetailsServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(requestData),
          headers: { 'X-CSRF-Token': _this5.get('csrfToken') },
          xhrFields: { withCredentials: true },
          success: function success(response) {
            if (response.status === "success") {
              _this5.set('isViewer', response.role.toLowerCase() === 'viewer');
              _this5.set('isOwnerOrEditor', response.role.toLowerCase() === 'owner' || response.role.toLowerCase() === 'editor');
              resolve(true);
            } else {
              resolve(false);
            }
          },
          error: function error() {
            resolve(false);
          }
        });
      }).then(function (exists) {
        if (!exists) {
          _this5.transitionToRoute('document-not-found');
        }
        return exists;
      });
    },

    validateSession: function validateSession() {
      var _this6 = this;

      return new Promise(function (resolve, reject) {
        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
          type: 'GET',
          headers: {
            'X-CSRF-Token': _this6.get('csrfToken')
          },
          xhrFields: { withCredentials: true },
          success: function success(response) {
            if (response.status !== "success") {
              _this6.transitionToRoute('login');
              reject("Session validation failed.");
            } else {
              _this6.set('loggedInUserEmail', response.email);
              resolve();
            }
          },
          error: function error() {
            _this6.transitionToRoute('login');
            reject("Session validation error.");
          }
        });
      });
    },

    loadDocumentDetails: function loadDocumentDetails(uniqueId) {
      var _this7 = this;

      var loggedInUserEmail = this.get('loggedInUserEmail');
      if (!loggedInUserEmail) {
        console.error("Logged in user email is not set.");
        return;
      }

      var requestData = {
        uniqueId: uniqueId,
        email: loggedInUserEmail
      };

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetDocumentDetailsServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(requestData),
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status === "success") {
            _this7.set('documentTitle', response.title);
            _this7.loadDocumentContent(uniqueId);
          } else {
            console.warn("Failed to load document details:", response.message);
          }
        },
        error: function error(xhr, status, _error3) {
          console.error("AJAX Error:", status, _error3);
        }
      });
    },

    loadDocumentContent: function loadDocumentContent(uniqueId) {
      var _this8 = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetDocumentContentServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ uniqueId: uniqueId }),
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status === "success") {
            _this8.set('documentContent', response.content);
            _this8.set('lastSavedContent', response.content); // Initialize last saved content
          } else {
              console.warn("Failed to load document content:", response.message);
            }
        },
        error: function error(xhr, status, _error4) {
          console.error("AJAX Error:", status, _error4);
        }
      });
    },

    fetchAllUsers: function fetchAllUsers() {
      var _this9 = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetAllUsersServlet',
        type: 'GET',
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status === "success") {
            _this9.set('allUsers', response.users);
          } else {
            console.warn("Failed to fetch users:", response.message);
          }
        },
        error: function error(xhr, status, _error5) {
          console.error("AJAX Error:", status, _error5);
        }
      });
    },

    saveDocumentContent: function saveDocumentContent() {
      var _this10 = this;

      var documentId = this.get('documentId');
      var content = _ember['default'].$('.document-editor').html();

      if (documentId && content && this.get('isOwnerOrEditor')) {
        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SaveDocumentContentServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ uniqueId: documentId, content: content }),
          headers: { 'X-CSRF-Token': this.get('csrfToken') },
          xhrFields: { withCredentials: true },
          success: function success(response) {
            if (response.status === "success") {
              var lastUpdated = new Date(response.last_updated);
              _this10.updateLastUpdatedMessage(lastUpdated);
              _this10.set('lastSavedContent', content); // Update last saved content
            } else {
                console.warn("Failed to save document content:", response.message);
                _this10.set('lastUpdatedMessage', "Failed to save document.");
              }
          },
          error: function error(xhr, status, _error6) {
            console.error("AJAX Error:", status, _error6);
            _this10.set('lastUpdatedMessage', "Error saving document.");
          }
        });
      }
    },

    updateLastUpdatedMessage: function updateLastUpdatedMessage(lastUpdated) {
      var now = new Date();
      var diffInSeconds = Math.floor((now - lastUpdated) / 1000);

      if (diffInSeconds < 60) {
        this.set('lastUpdatedMessage', "Document saved successfully.");
      } else {
        var diffInMinutes = Math.floor(diffInSeconds / 60);
        var diffInHours = Math.floor(diffInMinutes / 60);
        var diffInDays = Math.floor(diffInHours / 24);

        if (diffInDays > 0) {
          this.set('lastUpdatedMessage', 'Document updated ' + diffInDays + ' day(s) ago.');
        } else if (diffInHours > 0) {
          this.set('lastUpdatedMessage', 'Document updated ' + diffInHours + ' hour(s) ago.');
        } else {
          this.set('lastUpdatedMessage', 'Document updated ' + diffInMinutes + ' minute(s) ago.');
        }
      }
    },

    initWebSocket: function initWebSocket(documentId) {
      var _this11 = this;

      var socket = new WebSocket('ws://localhost:8080/DocsApp_war_exploded/ws/' + documentId);

      socket.onopen = function () {
        console.log("WebSocket connection established.");
      };

      socket.onmessage = function (event) {
        var data = JSON.parse(event.data);
        if (data.type === 'contentUpdate') {
          _this11.applyDeltaUpdate(data.content);
        } else if (data.type === 'titleUpdate') {
          _this11.set('documentTitle', data.title);
        } else if (data.type === 'initialContent') {
          _this11.set('documentContent', data.content);
          _this11.set('lastSavedContent', data.content);
          _this11.updateEditorContent(data.content);
        }
      };

      socket.onclose = function () {
        console.log("WebSocket connection closed.");
      };

      this.set('socket', socket);
    },

    applyDeltaUpdate: function applyDeltaUpdate(delta) {
      var currentContent = this.get('documentContent');
      console.log("Current Content:", currentContent);
      console.log("Delta:", delta);

      var updatedContent = currentContent;

      if (delta) {
        switch (delta.operation) {
          case 'ADD':
            updatedContent = this.insertContent(currentContent, delta.position, delta.content);
            break;
          case 'SUB':
            updatedContent = this.deleteContent(currentContent, delta.position, delta.content);
            break;
          case 'REPLACE':
            updatedContent = this.replaceContent(currentContent, delta.position, delta.oldContent, delta.content);
            break;
          default:
            console.warn("Unknown delta operation:", delta.operation);
            return;
        }
        console.log("Updated Content:", updatedContent);
        this.set('documentContent', updatedContent);
        this.updateEditorContent(updatedContent);
      }
    },

    updateEditorContent: function updateEditorContent(content) {
      _ember['default'].run.next(function () {
        var editor = _ember['default'].$('.document-editor');
        if (editor.html() !== content) {
          editor.html(content);
        }
      });
    },

    insertContent: function insertContent(content, position, newContent) {
      return content.slice(0, position) + newContent + content.slice(position);
    },

    deleteContent: function deleteContent(content, position, length) {
      return content.slice(0, position) + content.slice(position + length);
    },

    replaceContent: function replaceContent(content, position, oldContent, newContent) {
      return content.slice(0, position) + newContent + content.slice(position + oldContent.length);
    },

    sendContentUpdate: function sendContentUpdate(content) {
      var socket = this.get('socket');
      if (socket && socket.readyState === WebSocket.OPEN && this.get('isOwnerOrEditor')) {
        var delta = this.calculateDelta(this.get('lastSavedContent'), content);
        if (delta) {
          socket.send(JSON.stringify({
            type: 'contentUpdate',
            content: delta
          }));
          this.set('lastSavedContent', content);
        }
      }
    },

    calculateDelta: function calculateDelta(oldContent, newContent) {
      if (!oldContent || !newContent) {
        return newContent;
      }

      var start = 0;
      while (start < oldContent.length && start < newContent.length && oldContent[start] === newContent[start]) {
        start++;
      }

      var endOld = oldContent.length - 1;
      var endNew = newContent.length - 1;
      while (endOld >= start && endNew >= start && oldContent[endOld] === newContent[endNew]) {
        endOld--;
        endNew--;
      }

      if (endOld < start && endNew < start) {
        return null;
      } else if (endOld < start) {
        return {
          operation: 'ADD',
          position: start,
          content: newContent.substring(start, endNew + 1)
        };
      } else if (endNew < start) {
        return {
          operation: 'SUB',
          position: start,
          content: oldContent.substring(start, endOld + 1).length
        };
      } else {
        return {
          operation: 'REPLACE',
          position: start,
          content: newContent.substring(start, endNew + 1),
          oldContent: oldContent.substring(start, endOld + 1)
        };
      }
    },

    sendTitleUpdate: function sendTitleUpdate(title) {
      var socket = this.get('socket');
      if (socket && socket.readyState === WebSocket.OPEN && this.get('isOwnerOrEditor')) {
        socket.send(JSON.stringify({
          type: 'titleUpdate',
          title: title
        }));
      }
    },

    actions: {

      toggleFavorite: function toggleFavorite() {
        this.toggleFavorite();
      },

      trackTitleChange: function trackTitleChange() {
        var title = _ember['default'].$(".document-title").text().trim();
        this.set('updatedTitle', title);
      },

      updateTitle: function updateTitle() {
        var _this12 = this;

        if (!this.get('isOwnerOrEditor')) {
          alert("You do not have permission to edit this document.");
          return;
        }

        var title = this.get('updatedTitle');
        var uniqueId = this.get('documentId');

        if (!title || !uniqueId) {
          return;
        }

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/UpdateDocumentTitleServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ uniqueId: uniqueId, title: title }),
          headers: { 'X-CSRF-Token': this.get('csrfToken') },
          xhrFields: { withCredentials: true },
          success: function success(response) {
            if (response.status !== "success") {
              alert("Error updating document title.");
            } else {
              _this12.set('documentTitle', title);
              _this12.sendTitleUpdate(title);
            }
          },
          error: function error(xhr, status, _error7) {
            console.error("AJAX Error:", status, _error7);
            alert("Error updating document title.");
          }
        });
      },

      handleEmailInput: function handleEmailInput(event) {
        var _this13 = this;

        var inputValue = event.target.value.trim().toLowerCase();
        if (inputValue.includes('@')) {
          (function () {
            var loggedInUserEmail = _this13.get('loggedInUserEmail');
            var filteredUsers = _this13.get('allUsers').filter(function (user) {
              return user.toLowerCase().includes(inputValue) && user !== loggedInUserEmail;
            });

            _this13.set('filteredUsers', filteredUsers);
            _ember['default'].$('#email-dropdown').show();
          })();
        } else {
          this.set('filteredUsers', []);
          _ember['default'].$('#email-dropdown').hide();
        }
      },

      selectEmail: function selectEmail(email) {
        _ember['default'].$('#email').val(email);
        _ember['default'].$('#email-dropdown').hide();
      },

      shareDocument: function shareDocument() {
        var _this14 = this;

        if (!this.get('isOwnerOrEditor')) {
          alert("You do not have permission to share this document.");
          return;
        }

        var email = _ember['default'].$('#email').val().trim();
        var accessLevel = _ember['default'].$('.access-level').val();
        var documentId = this.get('documentId');

        if (!email || !documentId) {
          alert("Please enter a valid email and ensure the document is loaded.");
          return;
        }

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/UpdatePermissionsServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ email: email, documentId: documentId, role: accessLevel }),
          headers: { 'X-CSRF-Token': this.get('csrfToken') },
          xhrFields: { withCredentials: true },
          success: function success(response) {
            if (response.status === "success") {
              // Send email to the user
              _this14.sendShareEmail(email, documentId, accessLevel);

              _ember['default'].$('#success-popup').show();
              _ember['default'].$('#share-popup').hide();
              _ember['default'].$('#email').val('');
              _ember['default'].$('.access-level').val('Viewer');
              setTimeout(function () {
                _ember['default'].$('#success-popup').hide();
              }, 2000);
            } else {
              alert("Error sharing document: " + response.message);
            }
          },
          error: function error(xhr, status, _error8) {
            console.error("AJAX Error:", status, _error8);
            alert("Error sharing document.");
          }
        });
      },

      updateContent: function updateContent() {
        if (!this.get('isOwnerOrEditor')) {
          alert("You do not have permission to edit this document.");
          return;
        }

        var content = _ember['default'].$('.document-editor').html();
        this.sendContentUpdate(content);
      },

      saveDocument: function saveDocument() {
        this.saveDocumentContent();
      },

      saveAsWord: function saveAsWord() {
        var content = this.get('documentContent');
        var title = this.get('documentTitle') || 'Untitled';
        var htmlContent = '\n        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">\n          <head>\n            <meta charset="UTF-8">\n            <title>' + title + '</title>\n          </head>\n          <body>\n            ' + content + '\n          </body>\n        </html>\n      ';

        var blob = new Blob([htmlContent], { type: 'application/msword' });
        var url = URL.createObjectURL(blob);

        var link = document.createElement('a');
        link.href = url;
        link.download = title + '.doc';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    },

    sendShareEmail: function sendShareEmail(email, documentId, accessLevel) {
      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SendShareEmailServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: email, documentId: documentId, accessLevel: accessLevel }),
        headers: { 'X-CSRF-Token': this.get('csrfToken') },
        xhrFields: { withCredentials: true },
        success: function success(response) {
          if (response.status !== "success") {
            console.warn("Failed to send email:", response.message);
          }
        },
        error: function error(xhr, status, _error9) {
          console.error("AJAX Error:", status, _error9);
        }
      });
    }

  });
});
/* globals WebSocket, alert, URL, Blob */
define('docsapp/controllers/favorites', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    isProfilePopupVisible: false,
    username: null,
    email: null,
    favouriteDocuments: [],
    searchQuery: '',

    filteredFavouriteDocuments: _ember['default'].computed('favouriteDocuments.[]', 'searchQuery', function () {
      var searchQuery = this.get('searchQuery').toLowerCase();
      var favouriteDocuments = this.get('favouriteDocuments');

      if (!searchQuery) {
        return favouriteDocuments;
      }

      return favouriteDocuments.filter(function (doc) {
        return doc.title.toLowerCase().includes(searchQuery);
      });
    }),

    init: function init() {
      var _this = this;

      this._super.apply(this, arguments);
      this.validateSession();

      setInterval(function () {
        if (_this.username) {
          _this.loadFavouriteDocuments(_this.username);
        }
      }, 5000);
    },

    validateSession: function validateSession() {
      var _this2 = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
        type: 'GET',
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this2.setProperties({
              username: response.username,
              email: response.email
            });

            if (!sessionStorage.getItem('dashboardReloaded')) {
              sessionStorage.setItem('dashboardReloaded', 'true');
              location.reload();
            }

            _this2.loadFavouriteDocuments(response.username);
          } else {
            _this2.transitionToRoute('login');
          }
        },
        error: function error() {
          _this2.transitionToRoute('login');
        }
      });
    },

    loadFavouriteDocuments: function loadFavouriteDocuments() {
      var _this3 = this;

      var email = this.get('email');
      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetFavouriteDocumentsServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: email }),
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this3.set('favouriteDocuments', response.documents);
          } else {
            console.warn("Failed to fetch favourite documents:", response.message);
          }
        },
        error: function error() {
          alert("Error fetching favourite documents.");
        }
      });
    },

    actions: {
      toggleProfilePopup: function toggleProfilePopup() {
        this.toggleProperty('isProfilePopupVisible');
      },
      logout: function logout() {
        var _this4 = this;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/LogoutServlet',
          type: 'POST',
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            sessionStorage.removeItem('dashboardReloaded');
            _this4.transitionToRoute('login');
          },
          error: function error() {
            _this4.transitionToRoute('login');
          }
        });
      },
      createDocument: function createDocument() {
        var uniqueId = this.generateUniqueId();
        var email = this.get('email');
        var url = '/document/' + uniqueId;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SaveDocumentServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ email: email, uniqueId: uniqueId }),
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            window.open(url, '_blank');
          },
          error: function error() {
            alert("Error saving document.");
          }
        });
      },
      openDocument: function openDocument(uniqueId) {
        var url = '/document/' + uniqueId;
        window.open(url, '_blank');
      },
      updateSearchQuery: function updateSearchQuery(query) {
        this.set('searchQuery', query);
      }
    },

    generateUniqueId: function generateUniqueId() {
      var uuid = undefined;

      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        uuid = window.crypto.randomUUID();
      } else {
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : r & 0x3 | 0x8;
          return v.toString(16);
        });
      }

      var timestamp = Date.now().toString(36);
      return uuid + '-' + timestamp;
    }
  });
});
/* globals alert,setInterval,sessionStorage */
define('docsapp/controllers/login', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    errorMessage: null,

    init: function init() {
      this._super.apply(this, arguments);
      this.checkSession();
    },

    checkSession: function checkSession() {
      var _this = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
        type: 'GET',
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this.transitionToRoute('dashboard');
          }
        },
        error: function error() {}
      });
    },

    actions: {
      login: function login() {
        var _this2 = this;

        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/LoginServlet',
          type: 'POST',
          contentType: 'application/json',
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          data: JSON.stringify({
            email: email,
            password: password
          }),
          xhrFields: {
            withCredentials: true
          },
          success: function success(response) {
            if (response.status === "success") {
              _this2.setProperties({
                errorMessage: null,
                email: '',
                password: '',
                csrfToken: response.csrfToken
              });
              _this2.transitionToRoute('dashboard');
            } else {
              _this2.showError(response.message || "Invalid credentials, please try again.");
            }
          },

          error: function error(xhr) {
            var errorMessage = xhr.responseJSON ? xhr.responseJSON.message : "Login failed. Check your credentials.";
            _this2.showError(errorMessage);
          }
        });
      },

      gotosignup: function gotosignup() {
        this.transitionToRoute('signup');
      }
    },

    showError: function showError(message) {
      var _this3 = this;

      this.set('errorMessage', message);

      setTimeout(function () {
        _this3.set('errorMessage', null);
      }, 3000);
    }
  });
});
define('docsapp/controllers/object', ['exports', '@ember/controller'], function (exports, _emberController) {
  exports['default'] = _emberController['default'];
});
define('docsapp/controllers/sharedwithme', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    isProfilePopupVisible: false,
    username: null,
    email: null,
    sharedDocuments: [],
    searchQuery: '',

    filteredDocuments: _ember['default'].computed('sharedDocuments.[]', 'searchQuery', function () {
      var searchQuery = this.get('searchQuery').toLowerCase();
      var sharedDocuments = this.get('sharedDocuments');

      if (!searchQuery) {
        return sharedDocuments;
      }

      return sharedDocuments.filter(function (doc) {
        return doc.title.toLowerCase().includes(searchQuery);
      });
    }),

    init: function init() {
      var _this = this;

      this._super.apply(this, arguments);
      this.validateSession();

      setInterval(function () {
        if (_this.username) {
          _this.loadSharedDocuments();
        }
      }, 5000);
    },

    validateSession: function validateSession() {
      var _this2 = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
        type: 'GET',
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this2.setProperties({
              username: response.username,
              email: response.email
            });

            if (!sessionStorage.getItem('dashboardReloaded')) {
              sessionStorage.setItem('dashboardReloaded', 'true');
              location.reload();
            }

            _this2.loadSharedDocuments();
          } else {
            _this2.transitionToRoute('login');
          }
        },
        error: function error() {
          _this2.transitionToRoute('login');
        }
      });
    },

    loadSharedDocuments: function loadSharedDocuments() {
      var _this3 = this;

      var email = this.get('email');

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/GetSharedDocumentsServlet',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ email: email }),
        headers: {
          'X-CSRF-Token': this.get('csrfToken')
        },
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this3.set('sharedDocuments', response.documents);
          } else {
            console.warn("Failed to fetch shared documents:", response.message);
          }
        },
        error: function error() {
          alert("Error fetching shared documents.");
        }
      });
    },

    actions: {
      toggleProfilePopup: function toggleProfilePopup() {
        this.toggleProperty('isProfilePopupVisible');
      },
      logout: function logout() {
        var _this4 = this;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/LogoutServlet',
          type: 'POST',
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            sessionStorage.removeItem('dashboardReloaded');
            _this4.transitionToRoute('login');
          },
          error: function error() {
            _this4.transitionToRoute('login');
          }
        });
      },
      createDocument: function createDocument() {
        var uniqueId = this.generateUniqueId();
        var email = this.get('email');
        var url = '/document/' + uniqueId;

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SaveDocumentServlet',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ email: email, uniqueId: uniqueId }),
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          xhrFields: {
            withCredentials: true
          },
          success: function success() {
            window.open(url, '_blank');
          },
          error: function error() {
            alert("Error saving document.");
          }
        });
      },
      openDocument: function openDocument(uniqueId) {
        var url = '/document/' + uniqueId;
        window.open(url, '_blank');
      },
      updateSearchQuery: function updateSearchQuery(query) {
        this.set('searchQuery', query);
      }
    },
    generateUniqueId: function generateUniqueId() {
      var uuid = undefined;

      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        uuid = window.crypto.randomUUID();
      } else {
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : r & 0x3 | 0x8;
          return v.toString(16);
        });
      }

      var timestamp = Date.now().toString(36);
      return uuid + '-' + timestamp;
    }
  });
});
/* globals alert,setInterval,sessionStorage */
define('docsapp/controllers/signup', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Controller.extend({
    errorMessage: null,

    init: function init() {
      this._super.apply(this, arguments);
      this.checkSession();
    },

    checkSession: function checkSession() {
      var _this = this;

      _ember['default'].$.ajax({
        url: 'http://localhost:8080/DocsApp_war_exploded/SessionValidationServlet',
        type: 'GET',
        xhrFields: {
          withCredentials: true
        },
        success: function success(response) {
          if (response.status === "success") {
            _this.transitionToRoute('dashboard');
          }
        },
        error: function error() {}
      });
    },

    actions: {
      signup: function signup() {
        var _this2 = this;

        var username = document.getElementById('username').value;
        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;
        var confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
          this.showError("Passwords do not match!");
          return;
        }

        _ember['default'].$.ajax({
          url: 'http://localhost:8080/DocsApp_war_exploded/SignupServlet',
          type: 'POST',
          contentType: 'application/json',
          headers: {
            'X-CSRF-Token': this.get('csrfToken')
          },
          data: JSON.stringify({
            username: username,
            email: email,
            password: password
          }),
          success: function success() {
            _this2.setProperties({
              errorMessage: null,
              username: '',
              email: '',
              password: '',
              confirmPassword: ''
            });
            _this2.transitionToRoute('login');
          },

          error: function error(xhr) {
            if (xhr.status === 409) {
              _this2.showError('Email already exists, try logging in.');
            } else {
              _this2.showError('Signup failed. Please try again.');
            }
            console.error(xhr.responseText);
          }

        });
      }
    },

    showError: function showError(message) {
      var _this3 = this;

      this.set('errorMessage', message);

      setTimeout(function () {
        _this3.set('errorMessage', null);
      }, 3000);
    }
  });
});
define('docsapp/helpers/eq', ['exports', '@ember/component/helper'], function (exports, _emberComponentHelper) {
  exports.eq = eq;

  function eq(params) {
    return params[0] === params[1];
  }

  exports['default'] = (0, _emberComponentHelper.helper)(eq);
});
define('docsapp/initializers/app-version', ['exports', 'ember-cli-app-version/initializer-factory', 'docsapp/config/environment'], function (exports, _emberCliAppVersionInitializerFactory, _docsappConfigEnvironment) {
  exports['default'] = {
    name: 'App Version',
    initialize: (0, _emberCliAppVersionInitializerFactory['default'])(_docsappConfigEnvironment['default'].APP.name, _docsappConfigEnvironment['default'].APP.version)
  };
});
define('docsapp/initializers/export-application-global', ['exports', 'ember', 'docsapp/config/environment'], function (exports, _ember, _docsappConfigEnvironment) {
  exports.initialize = initialize;

  function initialize() {
    var application = arguments[1] || arguments[0];
    if (_docsappConfigEnvironment['default'].exportApplicationGlobal !== false) {
      var theGlobal;
      if (typeof window !== 'undefined') {
        theGlobal = window;
      } else if (typeof global !== 'undefined') {
        theGlobal = global;
      } else if (typeof self !== 'undefined') {
        theGlobal = self;
      } else {
        // no reasonable global, just bail
        return;
      }

      var value = _docsappConfigEnvironment['default'].exportApplicationGlobal;
      var globalName;

      if (typeof value === 'string') {
        globalName = value;
      } else {
        globalName = _ember['default'].String.classify(_docsappConfigEnvironment['default'].modulePrefix);
      }

      if (!theGlobal[globalName]) {
        theGlobal[globalName] = application;

        application.reopen({
          willDestroy: function willDestroy() {
            this._super.apply(this, arguments);
            delete theGlobal[globalName];
          }
        });
      }
    }
  }

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };
});
define('docsapp/router', ['exports', 'ember', 'docsapp/config/environment'], function (exports, _ember, _docsappConfigEnvironment) {

  var Router = _ember['default'].Router.extend({
    location: _docsappConfigEnvironment['default'].locationType
  });

  Router.map(function () {
    this.route('login');
    this.route('dashboard');
    this.route('document', { path: '/document/:document_id' });
    this.route('signup');
    this.route('sharedwithme');
    this.route('document-not-found');
    this.route('sidebar');
    this.route('favorites');
  });

  exports['default'] = Router;
});
define('docsapp/routes/dashboard', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define('docsapp/routes/document-not-found', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define('docsapp/routes/document', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({
    model: function model(params) {
      return {
        document_id: params.document_id
      };
    },

    actions: {
      goBack: function goBack() {
        this.transitionTo('dashboard');
      },
      openSharePopup: function openSharePopup() {
        document.getElementById('share-popup').style.display = 'block';
      },
      closeSharePopup: function closeSharePopup() {
        document.getElementById('share-popup').style.display = 'none';
      },
      toggleMenu: function toggleMenu() {
        document.getElementById('sidebar').classList.toggle('open');
      }
    },

    setupController: function setupController(controller, model) {
      this._super(controller, model);

      _ember['default'].run.scheduleOnce('afterRender', this, this.initializeDocumentEditor);
    },

    initializeDocumentEditor: function initializeDocumentEditor() {
      var editor = document.querySelector('.document-editor');
      var container = document.querySelector('.document-container');
      var sidebar = document.getElementById('sidebar1');
      var menuToggle = document.getElementById('menu-toggle');

      if (menuToggle) {
        menuToggle.addEventListener('click', function () {
          sidebar.classList.toggle('open');

          if (sidebar.classList.contains('open')) {
            menuToggle.innerHTML = '&times;';
          } else {
            menuToggle.innerHTML = '☰';
          }
        });
      }

      var closeSidebarButton = document.getElementById('close-sidebar');
      if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', function () {
          sidebar.classList.remove('open');
          menuToggle.innerHTML = '☰';
        });
      }

      var fontStyle = document.getElementById('font-style');
      if (fontStyle) {
        fontStyle.addEventListener('change', function () {
          editor.style.fontFamily = this.value;
        });
      }

      var fontColor = document.getElementById('font-color');
      if (fontColor) {
        fontColor.addEventListener('input', function () {
          editor.style.color = this.value;
        });
      }

      var fontSize = document.getElementById('font-size');
      if (fontSize) {
        fontSize.addEventListener('input', function () {
          editor.style.fontSize = this.value + 'px';
        });
      }

      var alignmentButtons = document.querySelectorAll('.alignment-buttons button');
      if (alignmentButtons) {
        alignmentButtons.forEach(function (button) {
          button.addEventListener('click', function () {
            editor.style.textAlign = this.getAttribute('data-align');
          });
        });
      }

      var spacing = document.getElementById('spacing');
      if (spacing) {
        spacing.addEventListener('input', function () {
          editor.style.lineHeight = this.value + 'px';
        });
      }

      if (editor) {
        editor.addEventListener('input', function () {
          checkOverflow(editor);
        });
      }

      function checkOverflow(element) {
        if (element.scrollHeight > element.clientHeight) {
          createNewPage();
        }
      }

      function createNewPage() {
        var newPage = document.createElement('div');
        newPage.className = 'document-editor new-page';
        newPage.setAttribute('contenteditable', 'true');
        container.appendChild(newPage);
        newPage.focus();
      }
    }
  });
});
define('docsapp/routes/favorites', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define('docsapp/routes/login', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({
    actions: {
      gotosignup: function gotosignup() {
        this.transitionToRoute('signup');
      }
    }
  });
});
define('docsapp/routes/sharedwithme', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define('docsapp/routes/sidebar', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define('docsapp/routes/signup', ['exports', 'ember'], function (exports, _ember) {
  exports['default'] = _ember['default'].Route.extend({});
});
define("docsapp/templates/application", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "docsapp/templates/application.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment, 1, 1, contextualElement);
        return morphs;
      },
      statements: [["content", "outlet", ["loc", [null, [3, 0], [3, 10]]]]],
      locals: [],
      templates: []
    };
  })());
});
define("docsapp/templates/dashboard", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 15,
              "column": 6
            },
            "end": {
              "line": 27,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/dashboard.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "profile-popup");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "close-popup");
          var el3 = dom.createTextNode("✖");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2, "src", "assets/profile-placeholder.jpg");
          dom.setAttribute(el2, "alt", "User");
          dom.setAttribute(el2, "class", "profile-img");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "user-details");
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createElement("strong");
          var el5 = dom.createTextNode("Email:");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "logout-button");
          var el3 = dom.createTextNode("Sign Out");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [5]);
          var element4 = dom.childAt(element1, [7]);
          var morphs = new Array(4);
          morphs[0] = dom.createElementMorph(element2);
          morphs[1] = dom.createMorphAt(dom.childAt(element3, [1]), 1, 1);
          morphs[2] = dom.createMorphAt(dom.childAt(element3, [3]), 2, 2);
          morphs[3] = dom.createElementMorph(element4);
          return morphs;
        },
        statements: [["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [17, 38], [17, 69]]]], ["content", "username", ["loc", [null, [21, 16], [21, 28]]]], ["content", "email", ["loc", [null, [22, 39], [22, 48]]]], ["element", "action", ["logout"], [], ["loc", [null, [25, 40], [25, 59]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 35,
              "column": 6
            },
            "end": {
              "line": 40,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/dashboard.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "document-card");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "document-thumbnail");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createElementMorph(element0);
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]), 0, 0);
          return morphs;
        },
        statements: [["element", "action", ["openDocument", ["get", "doc.uniqueId", ["loc", [null, [36, 59], [36, 71]]]]], [], ["loc", [null, [36, 35], [36, 73]]]], ["content", "doc.title", ["loc", [null, [38, 13], [38, 26]]]]],
        locals: ["doc"],
        templates: []
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 40,
              "column": 6
            },
            "end": {
              "line": 42,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/dashboard.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("p");
          var el2 = dom.createTextNode("No documents found.");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 46,
            "column": 0
          }
        },
        "moduleName": "docsapp/templates/dashboard.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/dashboard.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "dashboard-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "dashboard-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "top-bar");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "text");
        dom.setAttribute(el4, "placeholder", "Search documents...");
        dom.setAttribute(el4, "class", "search-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4, "class", "create-button");
        var el5 = dom.createTextNode(" Create New");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "user-profile");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("img");
        dom.setAttribute(el5, "src", "assets/profile-placeholder.jpg");
        dom.setAttribute(el5, "alt", "User");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("hr");
        dom.setAttribute(el3, "class", "solid1");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        var el4 = dom.createTextNode("My Documents");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "documents-grid");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element5 = dom.childAt(fragment, [2]);
        var element6 = dom.childAt(element5, [3]);
        var element7 = dom.childAt(element6, [1]);
        var element8 = dom.childAt(element7, [1]);
        var element9 = dom.childAt(element7, [3]);
        var element10 = dom.childAt(element7, [5]);
        var morphs = new Array(7);
        morphs[0] = dom.createMorphAt(element5, 1, 1);
        morphs[1] = dom.createAttrMorph(element8, 'value');
        morphs[2] = dom.createAttrMorph(element8, 'oninput');
        morphs[3] = dom.createElementMorph(element9);
        morphs[4] = dom.createElementMorph(element10);
        morphs[5] = dom.createMorphAt(element7, 7, 7);
        morphs[6] = dom.createMorphAt(dom.childAt(element6, [9]), 1, 1);
        return morphs;
      },
      statements: [["inline", "render", ["sidebar"], [], ["loc", [null, [4, 2], [4, 22]]]], ["attribute", "value", ["get", "searchQuery", ["loc", [null, [8, 86], [8, 97]]]]], ["attribute", "oninput", ["subexpr", "action", ["updateSearchQuery"], ["value", "target.value"], ["loc", [null, [8, 108], [8, 159]]]]], ["element", "action", ["createDocument"], [], ["loc", [null, [9, 14], [9, 41]]]], ["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [11, 32], [11, 63]]]], ["block", "if", [["get", "isProfilePopupVisible", ["loc", [null, [15, 12], [15, 33]]]]], [], 0, null, ["loc", [null, [15, 6], [27, 13]]]], ["block", "each", [["get", "filteredDocuments", ["loc", [null, [35, 14], [35, 31]]]]], [], 1, 2, ["loc", [null, [35, 6], [42, 15]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("docsapp/templates/document-not-found", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 15,
            "column": 8
          }
        },
        "moduleName": "docsapp/templates/document-not-found.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "document-not-found");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Sorry, there's no document here.");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("Possible reasons: The URL may be incorrect. Or, the document might have been removed.");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("style");
        var el2 = dom.createTextNode("\n  .document-not-found {\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n    align-items: center;\n    height: 100vh;\n    text-align: center;\n  }\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("docsapp/templates/document", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 16,
              "column": 4
            },
            "end": {
              "line": 20,
              "column": 4
            }
          },
          "moduleName": "docsapp/templates/document.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "last-updated-message");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 1, 1);
          return morphs;
        },
        statements: [["content", "lastUpdatedMessage", ["loc", [null, [18, 8], [18, 30]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      var child0 = (function () {
        return {
          meta: {
            "revision": "Ember@1.13.12",
            "loc": {
              "source": null,
              "start": {
                "line": 27,
                "column": 8
              },
              "end": {
                "line": 29,
                "column": 8
              }
            },
            "moduleName": "docsapp/templates/document.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("          ❤️\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      var child1 = (function () {
        return {
          meta: {
            "revision": "Ember@1.13.12",
            "loc": {
              "source": null,
              "start": {
                "line": 29,
                "column": 8
              },
              "end": {
                "line": 31,
                "column": 8
              }
            },
            "moduleName": "docsapp/templates/document.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("          ♡\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() {
            return [];
          },
          statements: [],
          locals: [],
          templates: []
        };
      })();
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 24,
              "column": 4
            },
            "end": {
              "line": 33,
              "column": 4
            }
          },
          "moduleName": "docsapp/templates/document.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1, "class", "share");
          var el2 = dom.createTextNode("Share");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1, "class", "favorite");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1]);
          var element2 = dom.childAt(fragment, [3]);
          var morphs = new Array(3);
          morphs[0] = dom.createElementMorph(element1);
          morphs[1] = dom.createElementMorph(element2);
          morphs[2] = dom.createMorphAt(element2, 1, 1);
          return morphs;
        },
        statements: [["element", "action", ["openSharePopup"], [], ["loc", [null, [25, 28], [25, 55]]]], ["element", "action", ["toggleFavorite"], [], ["loc", [null, [26, 31], [26, 58]]]], ["block", "if", [["get", "isFavorited", ["loc", [null, [27, 14], [27, 25]]]]], [], 0, 1, ["loc", [null, [27, 8], [31, 15]]]]],
        locals: [],
        templates: [child0, child1]
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 87,
              "column": 6
            },
            "end": {
              "line": 89,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/document.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "dropdown-item");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createElementMorph(element0);
          morphs[1] = dom.createMorphAt(element0, 0, 0);
          return morphs;
        },
        statements: [["element", "action", ["selectEmail", ["get", "user", ["loc", [null, [88, 58], [88, 62]]]]], [], ["loc", [null, [88, 35], [88, 64]]]], ["content", "user", ["loc", [null, [88, 65], [88, 73]]]]],
        locals: ["user"],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 114,
            "column": 6
          }
        },
        "moduleName": "docsapp/templates/document.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/document.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "document-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "document-header");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "class", "menu-toggle");
        var el4 = dom.createTextNode("☰");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "class", "header-button");
        var el4 = dom.createTextNode("Save");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "class", "header-button");
        var el4 = dom.createTextNode("Save As");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        dom.setAttribute(el3, "class", "document-title");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      \n\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "id", "sidebar");
        dom.setAttribute(el2, "class", "sidebar");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "id", "close-sidebar");
        dom.setAttribute(el3, "class", "close-sidebar");
        var el4 = dom.createTextNode("×");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "sidebar-content");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("br");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Font Style");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("select");
        dom.setAttribute(el4, "id", "font-style");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("option");
        dom.setAttribute(el5, "value", "Arial");
        var el6 = dom.createTextNode("Arial");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("option");
        dom.setAttribute(el5, "value", "Times New Roman");
        var el6 = dom.createTextNode("Times New Roman");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("option");
        dom.setAttribute(el5, "value", "Verdana");
        var el6 = dom.createTextNode("Verdana");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Text Color");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "color");
        dom.setAttribute(el4, "id", "font-color");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Font Size");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "number");
        dom.setAttribute(el4, "id", "font-size");
        dom.setAttribute(el4, "min", "10");
        dom.setAttribute(el4, "max", "50");
        dom.setAttribute(el4, "value", "16");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Alignment");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "alignment-buttons");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("button");
        dom.setAttribute(el5, "data-align", "left");
        var el6 = dom.createTextNode("Left");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("button");
        dom.setAttribute(el5, "data-align", "center");
        var el6 = dom.createTextNode("Center");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("button");
        dom.setAttribute(el5, "data-align", "right");
        var el6 = dom.createTextNode("Right");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Spacing");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "range");
        dom.setAttribute(el4, "id", "spacing");
        dom.setAttribute(el4, "min", "0");
        dom.setAttribute(el4, "max", "50");
        dom.setAttribute(el4, "value", "10");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "document-container");
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "document-editor");
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n  ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "id", "share-popup");
        dom.setAttribute(el1, "class", "popup");
        dom.setAttribute(el1, "style", "display: none;");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "popup-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "class", "close-popup");
        var el4 = dom.createTextNode("×");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h3");
        dom.setAttribute(el3, "class", "popup-title");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        var el5 = dom.createTextNode("Share");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4, "class", "doc-name");
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "input-group");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "text");
        dom.setAttribute(el4, "id", "email");
        dom.setAttribute(el4, "placeholder", "Add members by their email address or from a group");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("select");
        dom.setAttribute(el4, "class", "access-level");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("option");
        dom.setAttribute(el5, "value", "Viewer");
        dom.setAttribute(el5, "selected", "");
        var el6 = dom.createTextNode("View");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("option");
        dom.setAttribute(el5, "value", "Editor");
        var el6 = dom.createTextNode("Edit");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4, "class", "share-button");
        var el5 = dom.createTextNode("Share");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "id", "email-dropdown");
        dom.setAttribute(el3, "class", "email-dropdown");
        dom.setAttribute(el3, "style", "display: none;");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("hr");
        dom.setAttribute(el3, "class", "divider");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "who-can-access");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        var el5 = dom.createTextNode("Who can access");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "#");
        dom.setAttribute(el4, "class", "external-link");
        var el5 = dom.createTextNode("New external share link");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "permalink");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4, "class", "permalink-icon");
        var el5 = dom.createTextNode("🔗");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        var el5 = dom.createTextNode("Permalink - Private, not shared with anyone");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "visibility");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4, "class", "visibility-icon");
        var el5 = dom.createTextNode("⚙️");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4, "class", "change-visibility");
        var el5 = dom.createTextNode("Change Visibility");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment(" Success Popup ");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "id", "success-popup");
        dom.setAttribute(el1, "class", "popup");
        dom.setAttribute(el1, "style", "display: none;");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "popup-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3, "class", "checkmark");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h3");
        var el4 = dom.createTextNode("Document Shared Successfully!");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element3 = dom.childAt(fragment, [2]);
        var element4 = dom.childAt(element3, [1]);
        var element5 = dom.childAt(element4, [1]);
        var element6 = dom.childAt(element4, [3]);
        var element7 = dom.childAt(element4, [5]);
        var element8 = dom.childAt(element4, [7]);
        var element9 = dom.childAt(element3, [3, 1]);
        var element10 = dom.childAt(element3, [5, 1]);
        var element11 = dom.childAt(fragment, [4, 1]);
        var element12 = dom.childAt(element11, [1]);
        var element13 = dom.childAt(element11, [5]);
        var element14 = dom.childAt(element13, [1]);
        var element15 = dom.childAt(element13, [5]);
        var element16 = dom.childAt(element11, [15, 3]);
        var morphs = new Array(19);
        morphs[0] = dom.createElementMorph(element5);
        morphs[1] = dom.createElementMorph(element6);
        morphs[2] = dom.createElementMorph(element7);
        morphs[3] = dom.createAttrMorph(element8, 'contenteditable');
        morphs[4] = dom.createAttrMorph(element8, 'oninput');
        morphs[5] = dom.createAttrMorph(element8, 'onblur');
        morphs[6] = dom.createMorphAt(element8, 1, 1);
        morphs[7] = dom.createMorphAt(element4, 9, 9);
        morphs[8] = dom.createMorphAt(element4, 11, 11);
        morphs[9] = dom.createElementMorph(element9);
        morphs[10] = dom.createAttrMorph(element10, 'contenteditable');
        morphs[11] = dom.createAttrMorph(element10, 'oninput');
        morphs[12] = dom.createUnsafeMorphAt(element10, 1, 1);
        morphs[13] = dom.createElementMorph(element12);
        morphs[14] = dom.createMorphAt(dom.childAt(element11, [3, 3]), 0, 0);
        morphs[15] = dom.createAttrMorph(element14, 'oninput');
        morphs[16] = dom.createElementMorph(element15);
        morphs[17] = dom.createMorphAt(dom.childAt(element11, [7]), 1, 1);
        morphs[18] = dom.createElementMorph(element16);
        return morphs;
      },
      statements: [["element", "action", ["toggleMenu"], [], ["loc", [null, [5, 32], [5, 55]]]], ["element", "action", ["saveDocument"], [], ["loc", [null, [6, 34], [6, 59]]]], ["element", "action", ["saveAsWord"], [], ["loc", [null, [7, 34], [7, 57]]]], ["attribute", "contenteditable", ["subexpr", "unless", [["get", "isViewer", ["loc", [null, [10, 33], [10, 41]]]], "true", "false"], [], ["loc", [null, [10, 24], [10, 58]]]]], ["attribute", "oninput", ["subexpr", "action", ["trackTitleChange"], [], ["loc", [null, [11, 16], [11, 45]]]]], ["attribute", "onblur", ["subexpr", "action", ["updateTitle"], [], ["loc", [null, [12, 15], [12, 39]]]]], ["content", "documentTitle", ["loc", [null, [13, 6], [13, 23]]]], ["block", "if", [["get", "lastUpdatedMessage", ["loc", [null, [16, 10], [16, 28]]]]], [], 0, null, ["loc", [null, [16, 4], [20, 11]]]], ["block", "unless", [["get", "isViewer", ["loc", [null, [24, 14], [24, 22]]]]], [], 1, null, ["loc", [null, [24, 4], [33, 15]]]], ["element", "action", ["toggleMenu"], [], ["loc", [null, [37, 53], [37, 76]]]], ["attribute", "contenteditable", ["subexpr", "unless", [["get", "isViewer", ["loc", [null, [65, 56], [65, 64]]]], "true", "false"], [], ["loc", [null, [65, 47], [65, 81]]]]], ["attribute", "oninput", ["subexpr", "action", ["updateContent"], [], ["loc", [null, [65, 90], [65, 116]]]]], ["content", "documentContent", ["loc", [null, [66, 4], [66, 25]]]], ["element", "action", ["closeSharePopup"], [], ["loc", [null, [73, 32], [73, 60]]]], ["content", "documentTitle", ["loc", [null, [76, 29], [76, 46]]]], ["attribute", "oninput", ["subexpr", "action", ["handleEmailInput"], [], ["loc", [null, [79, 109], [79, 138]]]]], ["element", "action", ["shareDocument"], [], ["loc", [null, [84, 35], [84, 61]]]], ["block", "each", [["get", "filteredUsers", ["loc", [null, [87, 14], [87, 27]]]]], [], 2, null, ["loc", [null, [87, 6], [89, 15]]]], ["element", "action", ["changeVisibility"], [], ["loc", [null, [103, 40], [103, 69]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("docsapp/templates/favorites", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 15,
              "column": 6
            },
            "end": {
              "line": 27,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/favorites.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "profile-popup");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "close-popup");
          var el3 = dom.createTextNode("✖");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2, "src", "assets/profile-placeholder.jpg");
          dom.setAttribute(el2, "alt", "User");
          dom.setAttribute(el2, "class", "profile-img");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "user-details");
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createElement("strong");
          var el5 = dom.createTextNode("Email:");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "logout-button");
          var el3 = dom.createTextNode("Sign Out");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [5]);
          var element4 = dom.childAt(element1, [7]);
          var morphs = new Array(4);
          morphs[0] = dom.createElementMorph(element2);
          morphs[1] = dom.createMorphAt(dom.childAt(element3, [1]), 1, 1);
          morphs[2] = dom.createMorphAt(dom.childAt(element3, [3]), 2, 2);
          morphs[3] = dom.createElementMorph(element4);
          return morphs;
        },
        statements: [["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [17, 38], [17, 69]]]], ["content", "username", ["loc", [null, [21, 16], [21, 28]]]], ["content", "email", ["loc", [null, [22, 39], [22, 48]]]], ["element", "action", ["logout"], [], ["loc", [null, [25, 40], [25, 59]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 35,
              "column": 6
            },
            "end": {
              "line": 40,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/favorites.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "document-card");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "document-thumbnail");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createElementMorph(element0);
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]), 0, 0);
          return morphs;
        },
        statements: [["element", "action", ["openDocument", ["get", "doc.uniqueId", ["loc", [null, [36, 59], [36, 71]]]]], [], ["loc", [null, [36, 35], [36, 73]]]], ["content", "doc.title", ["loc", [null, [38, 13], [38, 26]]]]],
        locals: ["doc"],
        templates: []
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 40,
              "column": 6
            },
            "end": {
              "line": 42,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/favorites.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("p");
          var el2 = dom.createTextNode("No favourite documents found.");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 45,
            "column": 6
          }
        },
        "moduleName": "docsapp/templates/favorites.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/dashboard.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "dashboard-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "dashboard-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "top-bar");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "text");
        dom.setAttribute(el4, "placeholder", "Search favourite documents...");
        dom.setAttribute(el4, "class", "search-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4, "class", "create-button");
        var el5 = dom.createTextNode(" Create New");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "user-profile");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("img");
        dom.setAttribute(el5, "src", "assets/profile-placeholder.jpg");
        dom.setAttribute(el5, "alt", "User");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("hr");
        dom.setAttribute(el3, "class", "solid1");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        var el4 = dom.createTextNode("Favourite Documents");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "documents-grid");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element5 = dom.childAt(fragment, [2]);
        var element6 = dom.childAt(element5, [3]);
        var element7 = dom.childAt(element6, [1]);
        var element8 = dom.childAt(element7, [1]);
        var element9 = dom.childAt(element7, [3]);
        var element10 = dom.childAt(element7, [5]);
        var morphs = new Array(7);
        morphs[0] = dom.createMorphAt(element5, 1, 1);
        morphs[1] = dom.createAttrMorph(element8, 'value');
        morphs[2] = dom.createAttrMorph(element8, 'oninput');
        morphs[3] = dom.createElementMorph(element9);
        morphs[4] = dom.createElementMorph(element10);
        morphs[5] = dom.createMorphAt(element7, 7, 7);
        morphs[6] = dom.createMorphAt(dom.childAt(element6, [9]), 1, 1);
        return morphs;
      },
      statements: [["inline", "render", ["sidebar"], [], ["loc", [null, [4, 2], [4, 22]]]], ["attribute", "value", ["get", "searchQuery", ["loc", [null, [8, 96], [8, 107]]]]], ["attribute", "oninput", ["subexpr", "action", ["updateSearchQuery"], ["value", "target.value"], ["loc", [null, [8, 118], [8, 169]]]]], ["element", "action", ["createDocument"], [], ["loc", [null, [9, 14], [9, 41]]]], ["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [11, 32], [11, 63]]]], ["block", "if", [["get", "isProfilePopupVisible", ["loc", [null, [15, 12], [15, 33]]]]], [], 0, null, ["loc", [null, [15, 6], [27, 13]]]], ["block", "each", [["get", "filteredFavouriteDocuments", ["loc", [null, [35, 14], [35, 40]]]]], [], 1, 2, ["loc", [null, [35, 6], [42, 15]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("docsapp/templates/login", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 2
            },
            "end": {
              "line": 8,
              "column": 2
            }
          },
          "moduleName": "docsapp/templates/login.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "error-message");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
          return morphs;
        },
        statements: [["content", "errorMessage", ["loc", [null, [7, 31], [7, 47]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 27,
            "column": 10
          }
        },
        "moduleName": "docsapp/templates/login.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/login.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "login-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("form");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        var el4 = dom.createTextNode("Login");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "email");
        var el4 = dom.createTextNode("Email");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "password");
        var el4 = dom.createTextNode("Password");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "type", "submit");
        var el4 = dom.createTextNode("Login");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "type", "button");
        var el4 = dom.createTextNode("Signup");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [2]);
        var element1 = dom.childAt(element0, [5]);
        var element2 = dom.childAt(element1, [18]);
        var morphs = new Array(6);
        morphs[0] = dom.createMorphAt(element0, 3, 3);
        morphs[1] = dom.createElementMorph(element1);
        morphs[2] = dom.createMorphAt(element1, 7, 7);
        morphs[3] = dom.createMorphAt(element1, 11, 11);
        morphs[4] = dom.createElementMorph(element2);
        morphs[5] = dom.createMorphAt(fragment, 4, 4, contextualElement);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "errorMessage", ["loc", [null, [6, 8], [6, 20]]]]], [], 0, null, ["loc", [null, [6, 2], [8, 9]]]], ["element", "action", ["login"], ["on", "submit"], ["loc", [null, [10, 8], [10, 38]]]], ["inline", "input", [], ["type", "email", "id", "email", "placeholder", "Enter your Email", "value", ["subexpr", "@mut", [["get", "email", ["loc", [null, [15, 73], [15, 78]]]]], [], []], "required", true], ["loc", [null, [15, 4], [15, 94]]]], ["inline", "input", [], ["type", "password", "id", "password", "placeholder", "Enter your password", "value", ["subexpr", "@mut", [["get", "password", ["loc", [null, [18, 82], [18, 90]]]]], [], []], "required", true], ["loc", [null, [18, 4], [18, 106]]]], ["element", "action", ["gotosignup"], [], ["loc", [null, [23, 26], [23, 49]]]], ["content", "outlet", ["loc", [null, [27, 0], [27, 10]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
define("docsapp/templates/sharedwithme", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 15,
              "column": 6
            },
            "end": {
              "line": 27,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/sharedwithme.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "profile-popup");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "close-popup");
          var el3 = dom.createTextNode("✖");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2, "src", "assets/profile-placeholder.jpg");
          dom.setAttribute(el2, "alt", "User");
          dom.setAttribute(el2, "class", "profile-img");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "user-details");
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("p");
          var el4 = dom.createElement("strong");
          var el5 = dom.createTextNode("Email:");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode(" ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("button");
          dom.setAttribute(el2, "class", "logout-button");
          var el3 = dom.createTextNode("Sign Out");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element1 = dom.childAt(fragment, [1]);
          var element2 = dom.childAt(element1, [1]);
          var element3 = dom.childAt(element1, [5]);
          var element4 = dom.childAt(element1, [7]);
          var morphs = new Array(4);
          morphs[0] = dom.createElementMorph(element2);
          morphs[1] = dom.createMorphAt(dom.childAt(element3, [1]), 1, 1);
          morphs[2] = dom.createMorphAt(dom.childAt(element3, [3]), 2, 2);
          morphs[3] = dom.createElementMorph(element4);
          return morphs;
        },
        statements: [["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [17, 38], [17, 69]]]], ["content", "username", ["loc", [null, [21, 16], [21, 28]]]], ["content", "email", ["loc", [null, [22, 39], [22, 48]]]], ["element", "action", ["logout"], [], ["loc", [null, [25, 40], [25, 59]]]]],
        locals: [],
        templates: []
      };
    })();
    var child1 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 35,
              "column": 6
            },
            "end": {
              "line": 40,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/sharedwithme.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "document-card");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2, "class", "document-thumbnail");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createElementMorph(element0);
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]), 0, 0);
          return morphs;
        },
        statements: [["element", "action", ["openDocument", ["get", "doc.uniqueId", ["loc", [null, [36, 59], [36, 71]]]]], [], ["loc", [null, [36, 35], [36, 73]]]], ["content", "doc.title", ["loc", [null, [38, 13], [38, 26]]]]],
        locals: ["doc"],
        templates: []
      };
    })();
    var child2 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 40,
              "column": 6
            },
            "end": {
              "line": 42,
              "column": 6
            }
          },
          "moduleName": "docsapp/templates/sharedwithme.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("p");
          var el2 = dom.createTextNode("No shared documents found.");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() {
          return [];
        },
        statements: [],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 45,
            "column": 6
          }
        },
        "moduleName": "docsapp/templates/sharedwithme.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/dashboard.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "dashboard-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2, "class", "dashboard-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "top-bar");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("input");
        dom.setAttribute(el4, "type", "text");
        dom.setAttribute(el4, "placeholder", "Search documents...");
        dom.setAttribute(el4, "class", "search-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("button");
        dom.setAttribute(el4, "class", "create-button");
        var el5 = dom.createTextNode(" Create New");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4, "class", "user-profile");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("img");
        dom.setAttribute(el5, "src", "assets/profile-placeholder.jpg");
        dom.setAttribute(el5, "alt", "User");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("hr");
        dom.setAttribute(el3, "class", "solid1");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        var el4 = dom.createTextNode("Shared with Me");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3, "class", "documents-grid");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element5 = dom.childAt(fragment, [2]);
        var element6 = dom.childAt(element5, [3]);
        var element7 = dom.childAt(element6, [1]);
        var element8 = dom.childAt(element7, [1]);
        var element9 = dom.childAt(element7, [3]);
        var element10 = dom.childAt(element7, [5]);
        var morphs = new Array(7);
        morphs[0] = dom.createMorphAt(element5, 1, 1);
        morphs[1] = dom.createAttrMorph(element8, 'value');
        morphs[2] = dom.createAttrMorph(element8, 'oninput');
        morphs[3] = dom.createElementMorph(element9);
        morphs[4] = dom.createElementMorph(element10);
        morphs[5] = dom.createMorphAt(element7, 7, 7);
        morphs[6] = dom.createMorphAt(dom.childAt(element6, [9]), 1, 1);
        return morphs;
      },
      statements: [["inline", "render", ["sidebar"], [], ["loc", [null, [4, 2], [4, 22]]]], ["attribute", "value", ["get", "searchQuery", ["loc", [null, [8, 86], [8, 97]]]]], ["attribute", "oninput", ["subexpr", "action", ["updateSearchQuery"], ["value", "target.value"], ["loc", [null, [8, 108], [8, 159]]]]], ["element", "action", ["createDocument"], [], ["loc", [null, [9, 14], [9, 41]]]], ["element", "action", ["toggleProfilePopup"], [], ["loc", [null, [11, 32], [11, 63]]]], ["block", "if", [["get", "isProfilePopupVisible", ["loc", [null, [15, 12], [15, 33]]]]], [], 0, null, ["loc", [null, [15, 6], [27, 13]]]], ["block", "each", [["get", "filteredDocuments", ["loc", [null, [35, 14], [35, 31]]]]], [], 1, 2, ["loc", [null, [35, 6], [42, 15]]]]],
      locals: [],
      templates: [child0, child1, child2]
    };
  })());
});
define("docsapp/templates/sidebar", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 20,
            "column": 6
          }
        },
        "moduleName": "docsapp/templates/sidebar.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "dashboard-sidebar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        var el3 = dom.createTextNode("📝 Writer");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("hr");
        dom.setAttribute(el2, "class", "solid");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        var el3 = dom.createTextNode("Documents");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "document-not-found");
        var el5 = dom.createTextNode("Recents");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "dashboard");
        var el5 = dom.createTextNode("My Documents");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "sharedwithme");
        var el5 = dom.createTextNode("Shared with me");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "favorites");
        var el5 = dom.createTextNode("Favorites");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("hr");
        dom.setAttribute(el2, "class", "solid");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        var el3 = dom.createTextNode("Document Tasks");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "document-not-found");
        var el5 = dom.createTextNode("Assigned to me");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createElement("a");
        dom.setAttribute(el4, "href", "document-not-found");
        var el5 = dom.createTextNode("Initiated by me");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() {
        return [];
      },
      statements: [],
      locals: [],
      templates: []
    };
  })());
});
define("docsapp/templates/signup", ["exports"], function (exports) {
  exports["default"] = Ember.HTMLBars.template((function () {
    var child0 = (function () {
      return {
        meta: {
          "revision": "Ember@1.13.12",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 2
            },
            "end": {
              "line": 8,
              "column": 2
            }
          },
          "moduleName": "docsapp/templates/signup.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1, "class", "error-message");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]), 0, 0);
          return morphs;
        },
        statements: [["content", "errorMessage", ["loc", [null, [7, 31], [7, 47]]]]],
        locals: [],
        templates: []
      };
    })();
    return {
      meta: {
        "revision": "Ember@1.13.12",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 31,
            "column": 10
          }
        },
        "moduleName": "docsapp/templates/signup.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("link");
        dom.setAttribute(el1, "rel", "stylesheet");
        dom.setAttribute(el1, "href", "assets/signup.css");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1, "class", "login-page");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("form");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        var el4 = dom.createTextNode("Signup");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "username");
        var el4 = dom.createTextNode("Username");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "email");
        var el4 = dom.createTextNode("Email");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "password");
        var el4 = dom.createTextNode("Password");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3, "for", "confirmPassword");
        var el4 = dom.createTextNode("Confirm Password");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3, "type", "submit");
        var el4 = dom.createTextNode("Signup");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [2]);
        var element1 = dom.childAt(element0, [5]);
        var morphs = new Array(7);
        morphs[0] = dom.createMorphAt(element0, 3, 3);
        morphs[1] = dom.createElementMorph(element1);
        morphs[2] = dom.createMorphAt(element1, 7, 7);
        morphs[3] = dom.createMorphAt(element1, 11, 11);
        morphs[4] = dom.createMorphAt(element1, 15, 15);
        morphs[5] = dom.createMorphAt(element1, 19, 19);
        morphs[6] = dom.createMorphAt(fragment, 4, 4, contextualElement);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [["block", "if", [["get", "errorMessage", ["loc", [null, [6, 8], [6, 20]]]]], [], 0, null, ["loc", [null, [6, 2], [8, 9]]]], ["element", "action", ["signup"], ["on", "submit"], ["loc", [null, [10, 8], [10, 39]]]], ["inline", "input", [], ["type", "text", "id", "username", "placeholder", "Enter your username", "value", ["subexpr", "@mut", [["get", "username", ["loc", [null, [14, 78], [14, 86]]]]], [], []], "required", true], ["loc", [null, [14, 4], [14, 102]]]], ["inline", "input", [], ["type", "email", "id", "email", "placeholder", "Enter your Email", "value", ["subexpr", "@mut", [["get", "email", ["loc", [null, [17, 73], [17, 78]]]]], [], []], "required", true], ["loc", [null, [17, 4], [17, 94]]]], ["inline", "input", [], ["type", "password", "id", "password", "placeholder", "Enter your password", "value", ["subexpr", "@mut", [["get", "password", ["loc", [null, [20, 82], [20, 90]]]]], [], []], "required", true], ["loc", [null, [20, 4], [20, 106]]]], ["inline", "input", [], ["type", "password", "id", "confirmPassword", "placeholder", "Confirm your password", "value", ["subexpr", "@mut", [["get", "confirmPassword", ["loc", [null, [23, 91], [23, 106]]]]], [], []], "required", true], ["loc", [null, [23, 4], [23, 122]]]], ["content", "outlet", ["loc", [null, [31, 0], [31, 10]]]]],
      locals: [],
      templates: [child0]
    };
  })());
});
/* jshint ignore:start */

/* jshint ignore:end */

/* jshint ignore:start */

define('docsapp/config/environment', ['ember'], function(Ember) {
  var prefix = 'docsapp';
/* jshint ignore:start */

try {
  var metaName = prefix + '/config/environment';
  var rawConfig = Ember['default'].$('meta[name="' + metaName + '"]').attr('content');
  var config = JSON.parse(unescape(rawConfig));

  return { 'default': config };
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

/* jshint ignore:end */

});

if (!runningTests) {
  require("docsapp/app")["default"].create({"name":"docsapp","version":"0.0.0+"});
}

/* jshint ignore:end */
//# sourceMappingURL=docsapp.map