const chalk=require('chalk');

const defaultColor={
    log:'#ffffff',
    notify:'#0000cd',
    warning:'#ff4500',
    error:'#ff0000'
};

const levelMap={
    log:0,
    notify:1,
    warning:2,
    error:3
};

var logLevel='log';

function writeLog(from,level,msg,color)
{
/**
 * from:set log source, e.g.server/grpc/
 * level:log level, log->notify->warning->error
 * msg:log content
 * color:set color, require hex str, e.g. #FF0000
 *  */ 
    if (levelMap[level]==undefined) level='log';
    if (levelMap[level]<levelMap[logLevel]) return;
    var logStr='['+from+'] '+msg;
    if (color!=undefined)
    {
        console.log(chalk.hex(color)(logStr));
    }
    else console.log(chalk.hex(defaultColor[level])(logStr));
    return;
}

exports.writeLog=writeLog;
exports.logLevel=logLevel;