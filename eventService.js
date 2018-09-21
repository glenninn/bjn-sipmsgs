// --------------------------------------------------------------
//       The BlueJeans Event Handler Object
// --------------------------------------------------------------

function eventService(_, my, sockjs)
{
    var invokeIfImplemented = function(collection, methodName, arg)
    {
        return _.invoke(_.filter(collection, function (item)
        {
            return item[methodName] !== undefined;
        }), methodName, arg);
    };

    var EventService = my.Class(
    {
        events: function()
        {
            return {
                "guid_assigned": this.guidAssigned,
                "remoteclose": this.remoteclose,
                "pairingError": this.pairingError,
                "kicked": this.kicked
            };
        },

        maxReconnects: 10,

        reconnects: 0,

        reconnectBackoff: 1000,

        constructor: function()
        {
            this.handlers = {};
			this.cbStatus = null;
			this.cbError = null;
        },
		
		setStatusCallbacks : function(cbStatus,cbError){
			this.cbStatus = cbStatus;
			this.cbError = cbError;
		},
		
		errMsg : function(errstr){
			if(this.cbError) {
				this.cbError(errstr);
			}
		},
		
		statusMsg : function(smsg){
			if(this.cbStatus){
				this.cbStatus(smsg);
			}
		},

        registerHandler: function(handler, namespace, customOpts)
        {
            this.handlers[namespace] = handler;
        },

        setUpSocket: function(options, reconnect_count)
        {
            var self = this;
            var sock_url = options.eventServiceUrl || '';

            if (self.sock)
            {
                delete self.connected;
                if (self.joinTimeout)
                {
                    clearTimeout(self.joinTimeout);
                    delete self.joinTimeout;
                }

                self.sock.onclose = function()
                {
                    // Dummy function to avoid reconnect in the onclose method
                    // of previous socket connection.
                };
            }

            self.close(); //prevent multiple connections

            self.options = options;
            self.meetingAccessToken = options.access_token;

            var sockjs_protocols = [
                    'websocket', 'xdr-streaming', 'xhr-streaming',
                    'xdr-polling', 'xhr-polling', 'iframe-xhr-polling',
                    'jsonp-polling'
            ];
            
            var sock = self.sock = new sockjs(sock_url, {},
            {
                cookie: true,
                transports: sockjs_protocols
            });

            if (self.joinTimeout)
            {
                clearTimeout(self.joinTimeout);
                delete self.joinTimeout;
            }

            sock.onopen = function()
            {
                sock._selfclosed = false;
                sock._remoteclosed = false;

                if(self._crashed){
                    sock.close();
                    return;
                }
                 
                options.events = ['meeting', 'endpoint'];
                self.sendEvent('meeting.register', options);
                invokeIfImplemented(_.values(self.handlers), "onOpen", self.meetingAccessToken);
                self.reconnects = 0;
                if (reconnect_count && reconnect_count > 0)
                {
                    //window.Notifications.trigger('socket:reconnected');
                }

                self.joinTimeout = setTimeout(function()
                {
                   if(!self.connected)
                   {
                       self.sock.close();
                   }
                   delete self.joinTimeout;
                },10000);
            };

            sock.onmessage = function(_e)
            {
				var msg;
				try{
					msg = JSON.parse(_e.data);
				} catch(e) {
					self.errMsg("Parsing error");
				}
				
                try
                {
                    if ((msg.length == 2) && (typeof msg[1] === 'object'))
                    {
                        var evt = msg[0];

                        switch(evt)
                        {
                            case 'keepalive':
                                self.sendEvent("heartbeat");
                                break;
                            default:
                              var evt_data = msg[1];
                              if(evt_data && evt_data.reqId && self.reqCallbacks[evt_data.reqId])
                              {
                                var cb = self.reqCallbacks[evt_data.reqId];
                                delete self.reqCallbacks[evt_data.reqId];
                                cb(evt_data.error,evt_data.data);
                                break;
                              }

                              var protocolEvent = evt.match("([^.]*)$")[0];
							  
                              if (protocolEvent in self.events())
                              {
                                  //self.events()[protocolEvent](evt_data);
                                  var c = self.events()[protocolEvent];
                                  c.call(self, evt_data);
                              }
                              else
                              {
                                  var namespaces = _.keys(self.handlers);
                                  var eventNamespace = _.find(namespaces, function (namespace)
                                  {
                                      return evt.match("^"+namespace);
                                  });
								  
								  if(eventNamespace)
									  self.handlers[eventNamespace].onMessage(evt, evt_data);
                              }

                              break;
                        }
                    }
                    else
                    {
                        self.errMsg("JSON Received but not valid event: " + (msg[0] || ""));
                    }
                }
                catch (e)
                {
                    // console.log("ERROR: " + e)
                    //invalid json, discarding
                    self.errMsg("Error: Invalid JSON from SockJS - " + JSON.stringify(e));
                }
            };

            sock.onclose = function()
            {
                delete self.connected;

                if (self.joinTimeout)
                {
                    clearTimeout(self.joinTimeout);
                    delete self.joinTimeout;
                }
                if (
                    !self.sock._selfclosed &&
                    !self.sock._remoteclosed &&
                    !self._crashed &&

                    !self._timeoutClosed &&
                    !self._kicked

                    ) {
                    invokeIfImplemented(_.values(self.handlers), "onClosedUnexpectedly", {});
                    self.reconnect();
                }
                else
                {
                    invokeIfImplemented(_.values(self.handlers), "onClose", {});
                    //window.Notifications.trigger('socket:closed');
                }
                //Logger.warn("SockJS connection closed");
            };
            sock.onerror = function(e) {
                //Logger.warn("SockJS error occured");
                invokeIfImplemented(_.values(self.handlers), "onError", {});
            };
        },
		
        guidAssigned: function(event)
        {
            // console.log("Connected to event service. Endpoint guid: " + event.seamGuid + ", chat guid: " + event.guid);
			this.statusMsg("(Evt Svc: connected) Endpt guid: " + event.seamGuid );
			
            this.connected = true;
            //cofa.skinny.instances.selfParticipant.set({id: event.seamGuid});
            //invokeIfImplemented(_.values(this.handlers), "onConnect");
            //window.Notifications.trigger('socket:connected');
        },

        close: function()
        {
            this.connected = false;
            if (this.sock)
            {
                invokeIfImplemented(_.values(this.handlers), "onClose", {});
                //Logger.info("Closing SockJS connection");
                this.sock._selfclosed = true;
                this.sock.close();
            }
        },

        reconnect: function()
        {
            var self = this;
            self.errMsg("Reconnect!")
            this.connected = false;
            if (self.sock._remoteclosed) return;
            if (self.sock._kicked) return;
            if (self._timeoutClosed) return;
            if (self.reconnects < self.maxReconnects && self.meetingAccessToken && !self._reconnecting)
            {
                //window.Notifications.trigger('socket:reconnecting');
                self._reconnecting = true;
                setTimeout(function()
                {
                    self.errMsg("Reconnecting");
                    self.setUpSocket(self.options, self.reconnects);
                    self._reconnecting = false;
                    self.reconnects++;
                }, self.reconnectBackoff * (self.reconnects > 10 ? 10 : self.reconnects));
            }
        },

        remoteclose: function()
        {
            self.errMsg("remote close")
            var self = this;
            self.sock._remoteclosed = true;
            invokeIfImplemented(_.values(self.handlers), "remoteclose");
        },

        pairingError: function(error)
        {
            var self = this;
            self.errMsg("Error Pairing Meeting: "+ JSON.stringify(error));
            setTimeout(function()
            {
                self.sock.close();
            }, 200);
        },

        isDisconnected: function()
        {
            return !this.isConnected();
        },

        isConnected: function()
        {
            return this.sock && this.connected;
        },

        isJoinEvent: function(eventName)
        {
            return eventName === 'meeting.register';
        },

        sendEvent: function(event_name, event_data)
        {
            if (event_name === 'heartbeat' || this.isJoinEvent(event_name) || this.isConnected())
            {
                this.sock.send(JSON.stringify([event_name, event_data || {}]));
            }
            else
            {
                this.errMsg("Cant send event yet -- sock or guid not ready");
            }
        },

        sendRequest: function(event_name, event_data, callback)
        {
          if(this.isConnected())
          {
            if(!this.reqId)
            {
              this.reqId = 1;
            }
            else 
            {
              this.reqId++;
            }
            if(!this.reqCallbacks)
            {
              this.reqCallbacks = {};
            }
            this.reqCallbacks[this.reqId] = callback;
            this.sock.send(JSON.stringify([event_name, {reqId: this.reqId, data: (event_data || {})}]));
          } else {
            callback({error: {message: "Sending request while not connected."}});
          }
        },

        kicked: function(event)
        {
            this.errMsg("Kicked");
            this.sock._remoteclosed = true;
            this.sock._kicked = true;
            this.sock.close();
        },

        crashed: function()
        {
            this.errMsg("Crashed");
            this._crashed = true;
            this._idleTimeout();
        }
    });

    return new EventService();
}

module.exports.eventService = eventService;
