# Drachtio architecture

Drachtio is designed to make it easy for developers to integrate Voice-over IP (VoIP) features into their web applications; or, alternatively, to simply build full-on next generation VoIP applications without a traditional web (i.e. http) facade.  It couples an easy-to-use [express](http://expressjs.com/)-style web application framework with a high-performance [SIP](http://www.ietf.org/rfc/rfc3261.txt) processing engine that is built on the [sofia SIP stack](https://gitorious.org/sofia-sip).  

Drachtio consists of a client and a server component.  The server component is [drachtio-server](https://github.com/davehorton/drachtio-server) - a minimal, high-performance sip agent process which contains no application logic, but provides a SIP endpoint that can be controlled by clients that exchange [JSON](http://www.json.org) messages with the server over a TCP network connection.  The drachtio-server is written in C++ and designed to run as a daemon process, which may be remote or co-located with a drachtio application.

The client component is drachtio (i.e., this project), which is a node.js module that enables node applications to receive or make SIP calls, handle SIP registrations, and perform any other type of SIP call control by connecting to a [drachtio-server](https://github.com/davehorton/drachtio-server) instance.  

![drachtio architecture](http://www.dracht.io/images/drachtio-architecture.png)

The diagram above shows an example of 3 node server instances running 2 different drachtio applications, connecting to a drachtio-server that has connections to 3 different telecom carrier SIP networks.  In this diagram, SIP traffic and HTTP traffic are shown as being segmented onto different networks, which is a common network architecture used for highly scalable services.  Alternatively, SIP and HTTP traffic can be co-located on the same network, if desired.  Drachtio is designed to be suitable for carrier-class service provider installations as well as smaller footprint networks.

The drachtio clients and the drachtio-server pictured above may reside in the same network (even on the same server), or they may connect over an internet connection; e.g. as pictureud a service provider is hosting a drachtio-server and enabling services for remotely connecting web applications.



