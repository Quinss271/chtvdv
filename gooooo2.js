var place = document.querySelectorAll('div.current');
VPP.logined = 3;
for (var i = 0; i < VPP.chats.length; i++) {
	new Id(i);
	new Nick(i);
};

function Id(chatId) {
  VPP.chats[chatId].addEventListener(VPP.Chat.Event.CONNECTED, "mybot", function() {
  	var logined = VPP.logined;
    if (logined == '0') {
      VPP.chats[chatId].close();
      VPP.logined = null;
    };
    return;
  });
};

function Nick(chatId) {
  VPP.chats[chatId].addEventListener(VPP.Chat.Event.CONNECTED, "mybot", function() {
    currentChat = place[chatId].childNodes[2];
    if (currentChat.nodeType != 1) {
      currentChat = place[chatId].childNodes[1];
    };
    var newLi = document.createElement('li');
    if (VPP.logined == '1') newLi.style.color = 'blue';
    else newLi.style.color = 'red';
    newLi.innerHTML = VPP.chats[chatId].nicknameOpp;
    currentChat.appendChild(newLi);
    return;
  });
};

getAutoStart = function() {
  return VPP.chats[0].autoStart || (!VPP.chats[0].UI.getPaused() && (VPP.chats[0].autoStartOverride !== null ? VPP.chats[0].autoStartOverride : VPP.settings && VPP.settings.autoStart)
  );
};

VPP.chats[0].receiveSocketMessage = function(response) {
  var chat = VPP.chats[0];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[0] != this && VPP.chats[0].chatId == this.chatId) {
              VPP.chats[0].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!")
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[1]) + "/" + (+data[2]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[0].childNodes[2];
        if (currentChat.nodeType != 1) {
          currentChat = place[0].childNodes[1];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
VPP.chats[1].receiveSocketMessage = function(response) {
  var chat = VPP.chats[1];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[1] != this && VPP.chats[1].chatId == this.chatId) {
              VPP.chats[1].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!")
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[1]) + "/" + (+data[2]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[1].childNodes[2];
        if (currentChat.nodeType != 1) {
          currentChat = place[1].childNodes[1];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
VPP.chats[2].receiveSocketMessage = function(response) {
  var chat = VPP.chats[2];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[2] != this && VPP.chats[2].chatId == this.chatId) {
              VPP.chats[2].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!");
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[2]) + "/" + (+data[2]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[2].childNodes[2];
        if (currentChat.nodeType != 1) {
          currentChat = place[2].childNodes[2];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
VPP.chats[3].receiveSocketMessage = function(response) {
  var chat = VPP.chats[3];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[3] != this && VPP.chats[3].chatId == this.chatId) {
              VPP.chats[3].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!")
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[3]) + "/" + (+data[3]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[3].childNodes[3];
        if (currentChat.nodeType != 1) {
          currentChat = place[3].childNodes[3];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
VPP.chats[4].receiveSocketMessage = function(response) {
  var chat = VPP.chats[4];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[4] != this && VPP.chats[4].chatId == this.chatId) {
              VPP.chats[4].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!")
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[4]) + "/" + (+data[4]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[4].childNodes[4];
        if (currentChat.nodeType != 1) {
          currentChat = place[4].childNodes[4];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
VPP.chats[5].receiveSocketMessage = function(response) {
  var chat = VPP.chats[5];
  var userTyping = false;
  var userTypingTimeout = null;
  if (typeof response === "undefined") throw new TypeError(VPP.ErrorMessages.MISSING_ARGUMENT);
  if (typeof response === "string") response = JSON.parse(response);

  if (typeof response.action !== "undefined") switch (response.action) {

      case "user_connected":

        this.uid = response.id;
        this.nickname = response.unname;
        break;

      case "waiting_connect":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        break;

      case "captcha_required":

        if (response.access_token != null && response.access_token != this.accessToken) {
          VPP.settings.accessTokens[VPP.chats.indexOf(this)] = this.accessToken = response.access_token;
          VPP.settings.update("accessTokens");
        }
        this.UI.setStatus(VPP.Chat.Status.NONE);
        this.UI.showCaptcha(function(response) {
          chat.UI.setStatus(VPP.Chat.Status.CONNECTING_TO_USER);
          chat.sendSocketMessage({
            action: "captcha_solved",
            captcha_response: response,
            uid: chat.uid
          });
        });

        break;

      case "chat_connected":

        var time = Date.now();
        var len = VPP.settings.lastHourChats.time.length;
        if (!len || VPP.settings.lastHourChats.time[len - 1] < time - 60 * 1000) {
          VPP.settings.lastHourChats.time.push(time);
          VPP.settings.lastHourChats.count.push(1);
        } else VPP.settings.lastHourChats.count[len - 1]++;
        VPP.UI.updateChatsCreatedWarning();
        this.chatId = response.chat;
        if (!VPP.debug)
          for (var i = 0; i < VPP.chats.length; i++)
       		 if (VPP.chats[5] != this && VPP.chats[5].chatId == this.chatId) {
              VPP.chats[5].autoStart = true;
              this.close();
              setTimeout(function() {
                chat.start();
              }, 500);
              return;
            }
        var client = VPP.Chat.getClientByGUID(response.opp_guid);
        if (this.clientFilterEnabled &&
          (client === VPP.Chat.UserClient.BROWSER && VPP.settings.filter.clientsDisabled.browser ||
            client === VPP.Chat.UserClient.ANDROID && VPP.settings.filter.clientsDisabled.android ||
            client === VPP.Chat.UserClient.IOS && VPP.settings.filter.clientsDisabled.iOS ||
            client === VPP.Chat.UserClient.VPP && VPP.settings.filter.clientsDisabled.VPP)) {
          this.autoStart = true;
          this.close();
          this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          console.log("client disconnected");
          return;
        }
        this.guidOpp = response.opp_guid;
        if (response.is_lg == '1') VPP.logined = 1;
        else if (response.logined == '1') VPP.logined = 1;
        else VPP.logined = 0;
        this.nicknameOpp = response.opp_unname;
        this.UI.setStatus(VPP.Chat.Status.CHAT_STARTED);
        this.triggerEvent(VPP.Chat.Event.CONNECTED);
        break;

      case "unname_updated":

        if (this.isChatStarted() && response.unname == this.nicknameOpp) {
          clientConfirmed = true;
          if (this.clientFilterEnabled && VPP.settings.filter.clientsDisabled.VPP) {
            this.autoStart = true;
            this.close();
            this.UI.setStatus(VPP.Chat.Status.CLIENT_DISCONNECTED);
          } else this.UI.showUserClient();
        }

        break;

      case "chat_removed":

        if (this.isChatStarted()) {
          VPP.logined = null;
          this.chatId = null;
          this.uidOpp = null;
          this.userTyping = false;
          this.UI.setStatus(VPP.Chat.Status.USER_LEFT);
          this.UI.setImageFinishedLoading();
          startRequested = null;
          this.triggerEvent(VPP.Chat.Event.DISCONNECTED);
          if (getAutoStart()) this.start();
        }
        break;

	case "user_writing":
	
		if(this.isChatStarted() && this.uid != response.from) {
			this.uidOpp = response.from;
			this.UI.setStatus(VPP.Chat.Status.USER_TYPING);
			this.userTyping = true;
			this.triggerEvent(VPP.Chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout !== null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat.userTyping) {
					chat.userTyping = false;
					userTypingTimeout = null;
					chat.UI.setStatus(VPP.Chat.Status.NONE);
					setTimeout(function() {
						if(!chat.userTyping) chat.triggerEvent(VPP.Chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;

      case "message_from_user":

        if (this.isChatStarted()) {
          if (this.uid != response.from) this.uidOpp = response.from;
          var type = VPP.Chat.MessageType.TEXT;
          var content = response.message;
          if (response.message.indexOf("Image_msg:") == 0) {
            alert("IT IS!")
            type = VPP.Chat.MessageType.IMAGE;
            content = content.substring(10);
          } else if (response.message.indexOf("Sticker:") == 0) {
            type = VPP.Chat.MessageType.STICKER;
            var data = content.split(":");
            content = "https://chatvdvoem.ru/stickers/" + (+data[5]) + "/" + (+data[5]) + ".png";
          }
          this.UI.appendMessage(
            this.uid != response.from ? VPP.Chat.MessageSent.FROM : VPP.Chat.MessageSent.TO,
            type, content
          );
          this.triggerEvent(
            this.uid != response.from ? VPP.Chat.Event.MESSAGE_RECEIVED : VPP.Chat.Event.MESSAGE_DELIVERED,
            type, content
          );
        }

        break;
        
      case "block_status_updated":
        currentChat = place[5].childNodes[5];
        if (currentChat.nodeType != 1) {
          currentChat = place[5].childNodes[5];
        };
        var newLi = document.createElement('li');
        newLi.innerHTML = 'Friensip request!!!';
        newLi.style.textAlign = "center"
        newLi.style.color = 'red'
        currentChat.appendChild(newLi);
        break;

      case "message_send_fail":

        switch (response.error) {
          case "Can't send images in chats":
            this.UI.setImagesFail();
            break;
        }

        break;
    } else if (typeof response.error !== "undefined" && response.error !== "") switch (response.desc) {
      case "user blocked":

        blocked = true;
        this.socket.close();
        break;
    };

};
