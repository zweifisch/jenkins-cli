#!/usr/bin/env node

const Jenkins = require('./lib/jenkins')
const Table = require('cli-table2')
const fs = require('fs')
const {parse} = require('url')
const assert = require('assert')
const humanizeDuration = require('humanize-duration')

const trimLeft = (char, str) => {
    while(str.startsWith(char)) {
        str = str.substr(1)
    }
    return str
}

const parseArgv = argv => {
    let [node, script, ...rest] = argv
    let kwargs = {}
    let pargs = []
    let lastKey
    for (let arg of rest) {
        if (arg.startsWith('-')) {
            if (lastKey) {
                kwargs[lastKey] = true
            }
            let key = trimLeft('-', arg)
            lastKey = key
        } else {
            if (lastKey) {
                kwargs[lastKey] = arg
            } else {
                pargs.push(arg)
            }
            lastKey = null
        }
    }
    if (lastKey) {
        kwargs[lastKey] = true
    }
    return [pargs, kwargs]
}

const pick = (...keys) => object => {
    let ret = {}
    for (let key of keys) ret[key] = object[key]
    return ret
}

const write = ({format}, data) => {
    if (typeof data === 'string') {
        console.log(data)
    } else if (format === 'table') {
        let config = {
            chars: {'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''},
            style: {
                border: ['dark']
            }
        }
        if (Array.isArray(data)) {
            let head = Object.keys(data[0])
            let table = new Table({head, ...config})
            table.push(...data.map(x => head.map(field => x[field])))
            console.log(table.toString())
        } else {
            let table = new Table(config)
            table.push(...Object.keys(data).map(x => ({[x]: data[x]})))
            console.log(table.toString())
        }
    } else if (format === 'json') {
        console.log(JSON.stringify(data, null, 2))
    }
}

const humanizeName = object => ({...object, name: decodeURIComponent(object.name)})

const commands = {
    async list ({url, building}, name) {
        let jenkins = new Jenkins({url: url})
        let projects = await jenkins.listProjects()
        let expanedProjects = await Promise.all(projects.map(async (project) => {
            if (project._class === 'org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject') {
                let projects = await jenkins.listProjects(decodeURIComponent(project.name))
                return projects.map(x => ({...x, name: `${project.name} ${x.name}`}))
            }
            return [project]
        }))
        let results = [].concat(...expanedProjects).map(pick('name', 'url', 'color')).map(humanizeName)
        if (building)
            results = results.filter(x => x.color.endsWith('_anime'))
        if (name)
            results = results.filter(x => name ? x.name.match(new RegExp(name)) : true)
        return results
    },

    async builds ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        let project = await jenkins.getProject(...name)
        return project.jobs ?
            project.jobs.map(pick('name', 'url', 'color')).map(humanizeName) :
            project.builds.map(pick('number', 'url'))
    },

    async last ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        let project = await jenkins.getProject(...name)
        assert(project.lastStableBuild && project.lastStableBuild.number, 'no stable build available')
        let build = await jenkins.getBuild(...name, project.lastStableBuild.number)
        return {Number: build.number, Time: new Date(build.timestamp).toLocaleString(), Duration: humanizeDuration(build.duration)}
    },

    async dump ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        return jenkins.getProjectConfig(...name)
    },

    async disable ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        return jenkins.disableProject(...name)
    },

    async build ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        return jenkins.buildProject(...name)
    },

    async enable ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        return jenkins.enableProject(...name)
    },

    async artifacts ({url}, ...name) {
        let jenkins = new Jenkins({url: url})
        let project = await jenkins.getProject(...name)
        let number = project.lastStableBuild.number
        let build = await jenkins.getBuild(...name, number)
        return build.artifacts.map(x => ({
            file: `${build.url}artifact/${x.relativePath}`
        }))
    },

    async download ({url, ext}, ...name) {
        let jenkins = new Jenkins({url: url})
        let project = await jenkins.getProject(...name)
        let number = project.lastStableBuild.number
        let build = await jenkins.getBuild(...name, number)
        let artifacts = ext ? build.artifacts.filter(x => x.fileName.endsWith(ext)) : build.artifacts
        for (let artifact of artifacts) {
            const dest = fs.createWriteStream(artifact.fileName)
            let {path} = parse(`${build.url}artifact/${artifact.relativePath}`)
            let body = await jenkins.download(path)
            body.pipe(dest)
            console.log(`downloading ${artifact.fileName}`)
        }
    },

    async export ({url, path}) {
        let jenkins = new Jenkins({url: url})
        assert(path, '--path is required')
        let projects = await jenkins.listProjects()
        for (let project of projects) {
            let name = decodeURIComponent(project.name)
            let config = await jenkins.getProjectConfig(name)
            await new Promise((resolve, reject) => fs.writeFile(`${path}/${name}.xml`, config, 'utf8', err => err ? reject(err) : resolve()))
            console.log(`${name} processed`)
        }
    },

    async import ({url, path}) {
        let jenkins = new Jenkins({url: url})
        assert(path, '--path is required')
        let projects = fs.readdirSync(path).filter(x => x.endsWith('.xml'))
        for (let project of projects) {
            let name = project.substr(0, project.length - 4)
            await jenkins.createProject(name, fs.readFileSync(`${path}/${project}`, 'utf8'))
            console.log(`${name} processed`)
        }
    }
}


const main = async () => {
    let [pargs, kwargs] = parseArgv(process.argv)
    let [command, ...args] = pargs
    kwargs = {format: 'table', url: process.env.JENKINS_URL, ...kwargs}
    assert(kwargs.url, 'JENKINS_URL not specified')

    let availableCommands = Object.keys(commands).join('\n')
    assert(command, `avaialble commands:\n${availableCommands}`)
    assert(commands[command], `'${command}' is not defined, available commands:\n${availableCommands}`)
    let result = await commands[command].apply(null, [kwargs, ...args])

    if (result) {
        let {format} = kwargs
        write({format}, result)
    }
}

main().catch(e => console.log(e.message))
