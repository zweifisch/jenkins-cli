const fetch = require('node-fetch')
const qs = require('qs')
const createError = require('http-errors')
const {Cookie} = require('tough-cookie')
const FreshPromise = require('fresh-promise')
const {timeout, sleep} = require('promised-util')
const fs = require('fs')
const {fromPairs} = require('lodash')


class Request {
    constructor({baseUrl = '', encode = 'json', login, sessionTTL = 3600000, follow = 0, redirect = 'manual'} = {}) {
        this.baseUrl = baseUrl
        this.encode = 'json'
        if (login) {
            this.cookie = new FreshPromise(sessionTTL, () => {
                return login().headers.then(headers => {
                    return (headers.get('set-cookie') || '').split(';').map(Cookie.parse).join(';')
                }, err => {
                    return sleep(3000).then(() => {throw err})
                })
            })
        }
        this.options = {redirect, follow}
    }

    get json() {
        return this.response.then(r => r.json())
    }

    get safejson() {
        return this.text.then(text => {
            let chars = new Set('{["n')
            for (let i = 0; i < text.length ; i++) {
                if (chars.has(text.charAt(i))) {
                    return JSON.parse(text.substr(i))
                }
            }
            return undefined
        })
    }

    get text() {
        return this.response.then(r => r.text())
    }

    get headers() {
        return this.response.then(r => r.headers)
    }

    get cookies() {
        return this.response.then(r => fromPairs((r.headers.get('set-cookie') || '').split(';').map(Cookie.parse).map(x => [x.key, x.value])))
    }

    get ok() {
        return this.response.then(r => true)
    }

    get response() {
        return this._response.then(r => {
            if (r.status >= 400) {
                throw createError(r.status, r.statusText)
            }
            return r
        })
    }

    get body () {
        return this.response.then(r => r.body)
    }

    request(method, {url, query, body, headers}) {
        url = query ? `${this.baseUrl}${url}?${qs.stringify(query, {arrayFormat: 'brackets'})}` : `${this.baseUrl}${url}`
        if (body instanceof fs.ReadStream || !body) {
        } else if (typeof body === 'string') {
            headers = {'Content-Type': 'application/x-www-form-urlencoded', ...headers}
        } else if (this.encode === 'json') {
            body = JSON.stringify(body)
            headers = {'Content-Type': 'application/json', ...headers}
        }
        this._response = this.cookie
            ? this.cookie.then(cookie => fetch(url, {method, body, headers: {...headers, cookie}, ...this.options}))
        : fetch(url, {method, body, headers, ...this.options})
        return this
    }

    get(url, query, headers, body) {
        return this.request('GET', {url, body, query, headers})
    }

    delete(url, query, headers, body) {
        return this.request('DELETE', {url, body, query, headers})
    }

    post(url, body, query, headers) {
        return this.request('POST', {url, body, query, headers})
    }

    put(url, body, query, headers) {
        return this.request('PUT', {url, body, query, headers})
    }

    patch(url, body, query, headers) {
        return this.request('PATCH', {url, body, query, headers})
    }
}


const form = qs.stringify

const post = (...args) => new Request().post(...args)
const get = (...args) => new Request().get(...args)

module.exports = {
    Request, form, post, get
}
