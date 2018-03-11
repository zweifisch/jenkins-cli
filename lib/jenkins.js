const {Request} = require('./request')
const uuidv4 = require('uuid/v4')
const {escape} = require('./util')


const name2path = (...name) => name.map(x => escape`/job/${x}`).join('')


class Jenkins {

    constructor({url}){
        this.client = new Request({baseUrl: url})
    }

    get crumb() {
        return this.client.get('/crumbIssuer/api/json').json.then(x => x.crumb)
    }

    listProjects(...name) {
        return this.client.get(`${name2path(...name)}/api/json`).json.then(({jobs}) => jobs)
    }

    getProject(...name) {
        return this.client.get(`${name2path(...name)}/api/json`).json
    }

    getProjectConfig(...name) {
        return this.client.get(`${name2path(...name)}/config.xml`).text
    }

    async createProject(name, xml) {
        return this.client.post(escape`/createItem?name=${name}`, xml, null, {
            'Content-Type': 'text/xml; charset=utf-8',
            'Jenkins-Crumb': await this.crumb
        }).text
    }

    async disableProject(...name) {
        return this.client.post(`${name2path(...name)}/disable`, null, null, {'Jenkins-Crumb': await this.crumb}).text
    }

    async enableProject(...name) {
        let {crumb} = await this.client.get('/crumbIssuer/api/json').json
        return this.client.post(`${name2path(...name)}/enable`, null, null, {'Jenkins-Crumb': await this.crumb}).text
    }
    
    async buildProject(...name) {
        let {crumb} = await this.client.get('/crumbIssuer/api/json').json
        return this.client.post(`${name2path(...name)}/build`, null, null, {'Jenkins-Crumb': await this.crumb}).text
    }

    getBuild(...args) {
        let build = args.pop()
        return this.client.get(`${name2path(...args)}/${build}/api/json`).json
    }

    download (path) {
        return this.client.get(path).body
    }

}

module.exports = Jenkins
