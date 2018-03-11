
const escape = (strings, ...values) => {
    let ret = strings[0]
    for (let i = 0; i < values.length; i ++) {
        ret += encodeURIComponent(values[i]) + strings[i + 1] 
    }
    return ret
}

module.exports = {
    escape
}
