#!/usr/bin/env node
/**
 * BROP CDP Client - JavaScript implementation
 * Based on simple CDP implementation provided by user
 * 
 * This provides a native JavaScript interface to control the browser
 * through the BROP extension and bridge server.
 */

const UNDEFINED_VALUE = undefined;
const MESSAGE_EVENT = "message";
const OPEN_EVENT = "open";
const CLOSE_EVENT = "close";
const ERROR_EVENT = "error";
const CONNECTION_REFUSED_ERROR_CODE = "ConnectionRefused";
const CONNECTION_ERROR_CODE = "ConnectionError";
const MIN_INVALID_HTTP_STATUS_CODE = 400;
const GET_METHOD = "GET";
const PUT_METHOD = "PUT";

// BROP-specific defaults (pointing to our bridge server)
const DEFAULT_URL = "http://localhost:9225";
const DEFAULT_WS_URL = "ws://localhost:9222";
const DEFAULT_PATH = "json/version";
const DEFAULT_PATH_TARGETS = "json";
const DEFAULT_PATH_NEW_TARGET = "json/new";
const DEFAULT_PATH_ACTIVATE_TARGET = "json/activate";
const DEFAULT_PATH_CLOSE_TARGET = "json/close";
const DEFAULT_CONNECTION_MAX_RETRY = 20;
const DEFAULT_CONNECTION_RETRY_DELAY = 500;

const DEFAULT_OPTIONS = {
    apiUrl: DEFAULT_URL,
    apiPath: DEFAULT_PATH,
    apiPathTargets: DEFAULT_PATH_TARGETS,
    apiPathNewTarget: DEFAULT_PATH_NEW_TARGET,
    apiPathActivateTarget: DEFAULT_PATH_ACTIVATE_TARGET,
    apiPathCloseTarget: DEFAULT_PATH_CLOSE_TARGET,
    connectionMaxRetry: DEFAULT_CONNECTION_MAX_RETRY,
    connectionRetryDelay: DEFAULT_CONNECTION_RETRY_DELAY,
    webSocketDebuggerUrl: DEFAULT_WS_URL
};

class BROPCDPClient {
    #connection;
    #options = Object.assign({}, DEFAULT_OPTIONS);
    #pendingEventListenerCalls = new Map();

    constructor(options = {}) {
        // deno-lint-ignore no-this-alias
        const cdp = this;
        const proxy = new Proxy(Object.create(null), {
            get(target, propertyName) {
                if (propertyName in cdp) {
                    return cdp[propertyName];
                } else if (propertyName in target) {
                    return target[propertyName];
                } else {
                    return getDomain(target, propertyName);
                }
            }
        });
        Object.assign(cdp.#options, options);
        return proxy;

        function getDomain(target, domainName) {
            target[domainName] = new Proxy(Object.create(null), {
                get(target, methodName) {
                    if (methodName in this) {
                        return this[methodName];
                    } else if (methodName in target) {
                        return target[methodName];
                    } else {
                        return getDomainMethodFunction(target, methodName, domainName);
                    }
                },
                addEventListener: getDomainListenerFunction("addEventListener", domainName),
                removeEventListener: getDomainListenerFunction("removeEventListener", domainName)
            });
            return target[domainName];
        }

        function getDomainMethodFunction(target, methodName, domainName) {
            target[methodName] = async (params = {}, sessionId) => {
                await ready();
                const pendingEventListenerCalls = cdp.#pendingEventListenerCalls.get(domainName);
                if (pendingEventListenerCalls !== UNDEFINED_VALUE) {
                    while (pendingEventListenerCalls.length > 0) {
                        const { methodName, domainName, type, listener } = pendingEventListenerCalls.shift();
                        cdp.#connection[methodName](`${domainName}.${type}`, listener);
                    }
                    cdp.#pendingEventListenerCalls.delete(domainName);
                }
                return cdp.#connection.sendMessage(`${domainName}.${methodName}`, params, sessionId);
            };
            return target[methodName];
        }

        function getDomainListenerFunction(methodName, domainName) {
            return (type, listener) => {
                if (cdp.#connection === UNDEFINED_VALUE) {
                    let pendingEventListenerCalls = cdp.#pendingEventListenerCalls.get(domainName);
                    if (pendingEventListenerCalls === UNDEFINED_VALUE) {
                        pendingEventListenerCalls = [];
                        cdp.#pendingEventListenerCalls.set(domainName, pendingEventListenerCalls);
                    }
                    pendingEventListenerCalls.push({ methodName, domainName, type, listener });
                } else {
                    cdp.#connection[methodName](`${domainName}.${type}`, listener);
                }
            };
        }

        async function ready() {
            if (cdp.#connection === UNDEFINED_VALUE) {
                let webSocketDebuggerUrl = cdp.#options.webSocketDebuggerUrl;
                if (webSocketDebuggerUrl === UNDEFINED_VALUE) {
                    const url = new URL(cdp.#options.apiPath, cdp.#options.apiUrl);
                    try {
                        const versionData = await fetchData(url, cdp.#options);
                        webSocketDebuggerUrl = versionData.webSocketDebuggerUrl || DEFAULT_WS_URL;
                    } catch (error) {
                        console.warn('Failed to get version info, using default WebSocket URL:', error.message);
                        webSocketDebuggerUrl = DEFAULT_WS_URL;
                    }
                }
                const connection = new BROPConnection(webSocketDebuggerUrl);
                await connection.open();
                cdp.#connection = connection;
            }
        }
    }

    get options() {
        return this.#options;
    }

    set options(value) {
        Object.assign(this.#options, value);
    }

    get connection() {
        return this.#connection;
    }

    reset() {
        if (this.#connection !== UNDEFINED_VALUE) {
            this.#connection.close();
            this.#connection = UNDEFINED_VALUE;
            this.#pendingEventListenerCalls.clear();
        }
    }

    // BROP-specific convenience methods
    async getVersion() {
        await this.ready();
        return this.Browser.getVersion();
    }

    async getTargets() {
        await this.ready();
        return this.Target.getTargets();
    }

    async createTarget(url = 'about:blank') {
        await this.ready();
        return this.Target.createTarget({ url });
    }

    async activateTarget(targetId) {
        await this.ready();
        return this.Target.activateTarget({ targetId });
    }

    async closeTarget(targetId) {
        await this.ready();
        return this.Target.closeTarget({ targetId });
    }

    async takeScreenshot(targetId) {
        await this.ready();
        return this.Page.captureScreenshot();
    }

    async evaluateJS(expression, targetId) {
        await this.ready();
        return this.Runtime.evaluate({ expression, returnByValue: true });
    }

    async navigateTo(url, targetId) {
        await this.ready();
        return this.Page.navigate({ url });
    }

    // Static methods for HTTP API access
    static async getTargets(options = {}) {
        const opts = Object.assign({}, DEFAULT_OPTIONS, options);
        const url = new URL(opts.apiPathTargets, opts.apiUrl);
        return fetchData(url, opts);
    }

    static async createTarget(url, options = {}) {
        const opts = Object.assign({}, DEFAULT_OPTIONS, options);
        const path = url ? `${opts.apiPathNewTarget}?${url}` : opts.apiPathNewTarget;
        return fetchData(new URL(path, opts.apiUrl), opts, PUT_METHOD);
    }

    static async activateTarget(targetId, options = {}) {
        const opts = Object.assign({}, DEFAULT_OPTIONS, options);
        await fetchData(new URL(`${opts.apiPathActivateTarget}/${targetId}`, opts.apiUrl), opts, GET_METHOD, false);
    }

    static async closeTarget(targetId, options = {}) {
        const opts = Object.assign({}, DEFAULT_OPTIONS, options);
        await fetchData(new URL(`${opts.apiPathCloseTarget}/${targetId}`, opts.apiUrl), opts, GET_METHOD, false);
    }
}

class BROPConnection extends EventTarget {
    #webSocketDebuggerUrl;
    #webSocket;
    #pendingRequests = new Map();
    #nextRequestId = 0;

    constructor(webSocketDebuggerUrl) {
        super();
        this.#webSocketDebuggerUrl = webSocketDebuggerUrl;
    }

    open() {
        this.#webSocket = new WebSocket(this.#webSocketDebuggerUrl);
        this.#webSocket.addEventListener(MESSAGE_EVENT, (event) => {
            try {
                this.#onMessage(JSON.parse(event.data));
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error, event.data);
            }
        });

        return new Promise((resolve, reject) => {
            this.#webSocket.addEventListener(OPEN_EVENT, () => {
                console.log('🔗 Connected to BROP bridge server via WebSocket');
                resolve();
            });
            this.#webSocket.addEventListener(CLOSE_EVENT, (event) => {
                console.log('🔌 Disconnected from BROP bridge server');
                reject(new Error(event.reason || 'WebSocket connection closed'));
            });
            this.#webSocket.addEventListener(ERROR_EVENT, (error) => {
                console.error('🚫 WebSocket connection error:', error);
                reject(new Error('WebSocket connection failed'));
            });
        });
    }

    sendMessage(method, params = {}, sessionId) {
        const id = this.#nextRequestId;
        const message = { id, method, params };
        if (sessionId !== UNDEFINED_VALUE) {
            message.sessionId = sessionId;
        }
        
        const messageStr = JSON.stringify(message);
        this.#nextRequestId = (this.#nextRequestId + 1) % Number.MAX_SAFE_INTEGER;
        
        console.log(`📤 Sending CDP command: ${method}`);
        this.#webSocket.send(messageStr);
        
        let pendingRequest;
        const promise = new Promise((resolve, reject) => {
            pendingRequest = { resolve, reject, method, params, sessionId };
        });
        this.#pendingRequests.set(id, pendingRequest);
        
        // Add timeout to prevent hanging requests
        setTimeout(() => {
            if (this.#pendingRequests.has(id)) {
                this.#pendingRequests.delete(id);
                pendingRequest.reject(new Error(`Timeout waiting for response to ${method}`));
            }
        }, 10000); // 10 second timeout
        
        return promise;
    }

    close() {
        if (this.#webSocket) {
            this.#webSocket.close();
        }
    }

    #onMessage({ id, method, result, error, params, sessionId }) {
        if (id !== UNDEFINED_VALUE) {
            const pendingRequest = this.#pendingRequests.get(id);
            if (pendingRequest) {
                const { resolve, reject, method: requestMethod } = pendingRequest;
                if (error === UNDEFINED_VALUE) {
                    console.log(`📥 CDP response: ${requestMethod} -> SUCCESS`);
                    resolve(result);
                } else {
                    const message = `${error.message || 'Unknown error'} when calling ${requestMethod}(${JSON.stringify(params)})` +
                        `${sessionId === UNDEFINED_VALUE ? "" : ` (sessionId ${JSON.stringify(sessionId)})`}`;
                    const errorEvent = new Error(message);
                    errorEvent.code = error.code;
                    console.error(`📥 CDP response: ${requestMethod} -> ERROR:`, error.message);
                    reject(errorEvent);
                }
                this.#pendingRequests.delete(id);
            }
        }
        
        if (method !== UNDEFINED_VALUE) {
            console.log(`📡 CDP event: ${method}`);
            const event = new Event(method);
            Object.assign(event, { params, sessionId });
            this.dispatchEvent(event);
        }
    }
}

// Utility functions
function fetchData(url, options, method = GET_METHOD, parseJSON = true) {
    return retryConnection(async () => {
        let response;
        try {
            response = await fetch(url, { method });
        } catch (error) {
            error.code = CONNECTION_REFUSED_ERROR_CODE;
            throw error;
        }
        if (response.status >= MIN_INVALID_HTTP_STATUS_CODE) {
            const error = new Error(response.statusText || `HTTP Error ${response.status}`);
            error.status = response.status;
            error.code = CONNECTION_ERROR_CODE;
            throw error;
        } else {
            if (parseJSON) {
                return response.json();
            } else {
                return response.text();
            }
        }
    }, options);
}

async function retryConnection(fn, options, retryCount = 0) {
    const { connectionMaxRetry, connectionRetryDelay } = options;
    try {
        return await fn();
    } catch (error) {
        if (error.code === CONNECTION_REFUSED_ERROR_CODE && retryCount < connectionMaxRetry) {
            await new Promise((resolve) => setTimeout(resolve, connectionRetryDelay));
            return retryConnection(fn, options, retryCount + 1);
        } else {
            throw error;
        }
    }
}

// Create default instance and exports
const options = Object.assign({}, DEFAULT_OPTIONS);
const cdp = new BROPCDPClient(options);

// Static method aliases for convenience
const getTargets = BROPCDPClient.getTargets;
const createTarget = BROPCDPClient.createTarget;
const activateTarget = BROPCDPClient.activateTarget;
const closeTarget = BROPCDPClient.closeTarget;

// For Node.js module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BROPCDPClient,
        cdp,
        options,
        getTargets,
        createTarget,
        activateTarget,
        closeTarget,
        CONNECTION_REFUSED_ERROR_CODE,
        CONNECTION_ERROR_CODE
    };
}

// For browser usage
if (typeof window !== 'undefined') {
    window.BROP = {
        BROPCDPClient,
        cdp,
        options,
        getTargets,
        createTarget,
        activateTarget,
        closeTarget
    };
}

// Export for ES6 modules
export {
    BROPCDPClient,
    cdp,
    options,
    getTargets,
    createTarget,
    activateTarget,
    closeTarget,
    CONNECTION_REFUSED_ERROR_CODE,
    CONNECTION_ERROR_CODE
};