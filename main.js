/*
 * @Author: JindaiKirin 
 * @Date: 2018-07-09 10:52:50 
 * @Last Modified by: Jindai Kirin
 * @Last Modified time: 2018-11-23 17:20:05
 */
import CQWebsocket from 'cq-websocket';
import config from './config.json';
import saucenao from './modules/saucenao';
import {
	snDB
} from './modules/saucenao';
import whatanime from './modules/whatanime';
import CQ from './modules/CQcode';
import Pfsql from './modules/pfsql';
import Logger from './modules/Logger';
import RandomSeed from 'random-seed';
import Fs from 'fs';

import getSetu from './modules/plugin/setu';
import CQcode from './modules/CQcode';

const banListFile = './ban.json';

//初始化
Pfsql.sqlInitialize();
if (!Fs.existsSync(banListFile)) Fs.writeFileSync(banListFile, JSON.stringify({
	u: [],
	g: []
}));
let banList = require(banListFile);

function updateBanListFile() {
	Fs.writeFileSync(banListFile, JSON.stringify(banList));
}


//常量
const setting = config.picfinder;
const rand = RandomSeed.create();
const searchModeOnReg = new RegExp(setting.regs.searchModeOn);
const searchModeOffReg = new RegExp(setting.regs.searchModeOff);
const signReg = new RegExp(setting.regs.sign);
const setuReg = new RegExp(setting.regs.setu);
const addGroupReg = /--add-group=([0-9]+)/;
const banUserReg = /--ban-u=([0-9]+)/;
const banGroupReg = /--ban-g=([0-9]+)/;


let bot = new CQWebsocket(config);
let logger = new Logger();


//好友请求
bot.on('request.friend', (context) => {
	bot('set_friend_add_request', {
		flag: context.flag,
		approve: setting.autoAddFriend
	});
});


//管理员指令
bot.on('message.private', (e, context) => {
	if (context.user_id == setting.admin) {
		//允许加群
		let search = addGroupReg.exec(context.message);
		if (search) {
			replyMsg(context, `将会同意进入群${search[1]}的群邀请`);
			//注册一次性监听器
			bot.once('request.group.invite', (context2) => {
				if (context2.group_id == search[1]) {
					bot('set_group_add_request', {
						flag: context2.flag,
						type: "invite",
						approve: true
					});
					replyMsg(context, `已进入群${context2.group_id}`);
					return true;
				}
				return false;
			});
			return;
		}

		//停止程序（利用pm2重启）
		if (context.message == '--shutdown') process.exit();

		//Ban
		search = banUserReg.exec(context.message);
		if (search) {
			banList.u.push(parseInt(search[1]));
			replyMsg(context, `已封禁用户${search[1]}`);
			updateBanListFile();
			return;
		}
		search = banGroupReg.exec(context.message);
		if (search) {
			banList.g.push(parseInt(search[1]));
			replyMsg(context, `已封禁群组${search[1]}`);
			updateBanListFile();
			return;
		}
	}
});


//设置监听器
if (setting.debug) {
	//私聊
	bot.on('message.private', debugRrivateAndAtMsg);
	//讨论组@
	//bot.on('message.discuss.@me', debugRrivateAndAtMsg);
	//群组@
	bot.on('message.group.@me', debugRrivateAndAtMsg);
} else {
	//私聊
	bot.on('message.private', privateAndAtMsg);
	//讨论组@
	//bot.on('message.discuss.@me', privateAndAtMsg);
	//群组@
	bot.on('message.group.@me', privateAndAtMsg);
	//群组
	bot.on('message.group', groupMsg);
}


//连接相关监听
bot.on('socket.connecting', function (wsType, attempts) {
	console.log(new Date().toLocaleString() + ' 连接中[%s]#%d', wsType, attempts)
}).on('socket.connect', function (wsType, sock, attempts) {
	console.log(new Date().toLocaleString() + ' 连接成功[%s]#%d', wsType, attempts);
	if (setting.admin > 0) {
		setTimeout(() => {
			bot('send_private_msg', {
				user_id: setting.admin,
				message: `已上线[${wsType}]#${attempts}`
			});
		}, 5000)
	}
}).on('socket.failed', function (wsType, attempts) {
	console.log(new Date().toLocaleString() + ' 连接失败[%s]#%d', wsType, attempts)
})



bot.connect();


//自动帮自己签到（诶嘿
setInterval(() => {
	if (bot.isReady() && logger.canAdminSign()) {
		setTimeout(() => {
			if (setting.admin > 0) {
				bot('send_like', {
					user_id: setting.admin,
					times: 10
				});
			}
		}, 10 * 60 * 1000)
	}
}, 60 * 60 * 1000);



//通用处理
function commonHandle(e, context) {
	//黑名单检测
	if ((context.group_id && banList.g.includes(context.group_id)) || banList.u.includes(context.user_id)) return false;

	//兼容其他机器人
	let startChar = context.message.charAt(0);
	if (startChar == '/' || startChar == '<') return false;

	if (sendSetu(context)) return false;

	return true;
}


//私聊以及群组@的处理
function privateAndAtMsg(e, context) {
	if (!commonHandle(e, context)) return;

	if (hasImage(context.message)) {
		//搜图
		e.stopPropagation();
		searchImg(context);
	} else if (signReg.exec(context.message)) {
		//签到
		e.stopPropagation();
		if (logger.canSign(context.user_id)) {
			bot('send_like', {
				user_id: context.user_id,
				times: 10
			});
			return setting.replys.sign;
		} else return setting.replys.signed;
	} else if (context.message.search("--") !== -1) {
		return;
	} else if (!context.group_id && !context.discuss_id) {
		let db = snDB[context.message];
		if (db) {
			logger.smSwitch(0, context.user_id, true);
			logger.smSetDB(0, context.user_id, db);
			return `已临时切换至[${context.message}]搜图模式√`;
		} 
	} 
}

//调试模式
function debugRrivateAndAtMsg(e, context) {
	if (context.user_id != setting.admin) {
		e.stopPropagation();
		return setting.replys.debug;
	} else {
		privateAndAtMsg(e, context);
	}
}

//群组消息处理
function groupMsg(e, context) {
	if (!commonHandle(e, context)) return;

	//进入或退出搜图模式
	let group = context.group_id;
	let user = context.user_id;

	if (searchModeOnReg.exec(context.message)) {
		//进入搜图
		e.stopPropagation();
		if (logger.smSwitch(group, user, true))
			replyMsg(context, CQ.at(user) + setting.replys.searchModeOn);
		else
			replyMsg(context, CQ.at(user) + setting.replys.searchModeAlreadyOn);
	} else if (searchModeOffReg.exec(context.message)) {
		e.stopPropagation();
		//退出搜图
		if (logger.smSwitch(group, user, false))
			replyMsg(context, CQ.at(user) + setting.replys.searchModeOff)
		else
			replyMsg(context, CQ.at(user) + setting.replys.searchModeAlreadyOff);
	}

	//搜图模式检测
	let smStatus = logger.smStatus(group, user);
	if (smStatus) {
		//获取搜图模式下的搜图参数
		function getDB() {
			let cmd = /^(all|pixiv|danbooru|book|anime)$/.exec(context.message);
			if (cmd) return snDB[cmd[1]] || -1;
			return -1;
		}

		//切换搜图模式
		let cmdDB = getDB();
		if (cmdDB !== -1) {
			logger.smSetDB(group, user, cmdDB);
			smStatus = cmdDB;
			replyMsg(context, `已切换至[${context.message}]搜图模式√`)
		}

		//有图片则搜图
		if (hasImage(context.message)) {
			e.stopPropagation();
			searchImg(context, smStatus);
			logger.smSwitch(group, user, false);
		}
	} else if (setting.repeat.enable) { //复读（
		//随机复读，rptLog得到当前复读次数
		if (logger.rptLog(group, user, context.message) >= setting.repeat.times && getRand() <= setting.repeat.probability) {
			logger.rptDone(group);
			//延迟2s后复读
			setTimeout(() => {
				replyMsg(context, context.message);
			}, 2000);
		} else if (getRand() <= setting.repeat.commonProb) { //平时发言下的随机复读
			setTimeout(() => {
				replyMsg(context, context.message);
			}, 2000);
		}
	}
}


/**
 * 搜图
 *
 * @param {object} context
 * @param {number} [customDB=-1]
 * @returns
 */
async function searchImg(context, customDB = -1) {
	//提取参数
	function hasCommand(cmd) {
		return context.message.search("--" + cmd) !== -1;
	}
	replyMsg(context,"少女祈祷中……");
	//决定搜索库
	let db = snDB.all;
	if (customDB === -1) {
		if (hasCommand("pixiv")) db = snDB.pixiv;
		else if (hasCommand("danbooru")) db = snDB.danbooru;
		else if (hasCommand("book")) db = snDB.book;
		else if (hasCommand("anime")) db = snDB.anime;
		else if (!context.group_id && !context.discuss_id) {
			//私聊搜图模式
			let sdb = logger.smStatus(0, context.user_id);
			if (sdb) {
				db = sdb;
				logger.smSwitch(0, context.user_id, false);
			}
		}
	} else db = customDB;

	//得到图片链接并搜图
	let msg = context.message;
	let imgs = getImgs(msg);
	for (let img of imgs) {
		if (hasCommand("get-url")) replyMsg(context, img.url);
		else {
			//获取缓存
			let hasCache = false;
			let runCache = Pfsql.isEnable() && !hasCommand("purge");
			if (runCache) {
				let sql = new Pfsql();
				let cache = false;
				await sql.getCache(img.file, db).then(ret => {
					cache = ret;
				});
				sql.close();

				//如果有缓存
				if (cache) {
					hasCache = true;
					for (let cmsg of cache) {
						if (cmsg.indexOf('[CQ:share') !== -1) {
							cmsg = cmsg.replace('content=', 'content=&#91;缓存&#93; ');
						} else if (cmsg.indexOf('WhatAnime') !== -1) {
							cmsg = cmsg.replace('&#91;', '&#91;缓存&#93; &#91;');
						}
						replyMsg(context, cmsg);
					}
				}
			}

			if (!hasCache) {
				//检查搜图次数
				if (!logger.canSearch(context.user_id, setting.searchLimit)) {
					replyMsg(context, setting.replys.personLimit);
					return;
				}
				//开始搜索
				saucenao(img.url, db, hasCommand("debug")).then(async ret => {
					let success = ret.success; //如果有未成功的则不缓存

					replyMsg(context, ret.msg);
					replyMsg(context, ret.warnMsg);

					//如果需要缓存
					let needCacheMsgs;
					if (Pfsql.isEnable()) {
						needCacheMsgs = [];
						if (ret.msg.length > 0) needCacheMsgs.push(ret.msg);
					}

					//搜番
					if (db == 21 || ret.msg.indexOf("anidb.net") !== -1) {
						await whatanime(img.url, hasCommand("debug")).then(waRet => {
							if (!waRet.success) success = false; //如果搜番有误也视作不成功
							replyMsg(context, waRet.msg);
							if (Pfsql.isEnable() && waRet.msg.length > 0) needCacheMsgs.push(waRet.msg);
						});
					}

					//将需要缓存的信息写入数据库
					if (Pfsql.isEnable() && success) {
						let sql = new Pfsql();
						await sql.addCache(img.file, db, needCacheMsgs);
						sql.close();
					}
				});
			}
		}
	}
}


/**
 * 从消息中提取图片
 *
 * @param {string} msg
 * @returns 图片URL数组
 */
function getImgs(msg) {
	let reg = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/g;
	let result = [];
	let search = reg.exec(msg);
	while (search) {
		result.push({
			file: search[1],
			url: search[2]
		});
		search = reg.exec(msg);
	}
	return result;
}


/**
 * 判断消息是否有图片
 *
 * @param {string} msg 消息
 * @returns 有则返回true
 */
function hasImage(msg) {
	return msg.indexOf("[CQ:image") !== -1;
}


/**
 * 回复消息
 *
 * @param {object} context 消息对象
 * @param {string} msg 回复内容
 */
function replyMsg(context, msg) {
	if (typeof (msg) != "string" || !msg.length > 0) return;
	if (context.group_id) {
		return bot('send_group_msg', {
			group_id: context.group_id,
			message: msg
		});
	} else if (context.discuss_id) {
		return bot('send_discuss_msg', {
			discuss_id: context.discuss_id,
			message: msg
		});
	} else if (context.user_id) {
		return bot('send_private_msg', {
			user_id: context.user_id,
			message: msg
		});
	}
}


/**
 * 生成随机浮点数
 *
 * @returns 0到100之间的随机浮点数
 */
function getRand() {
	return rand.floatBetween(0, 100);
}


/**
 * 发送瑟图（
 *
 * @param {object} context
 * @returns 是否发送
 */
function sendSetu(context) {

	if (setuReg.exec(context.message)) {
		let pass = false;
		let limit = {
			value: setting.setu.limit,
			cd: setting.setu.cd
		};

		//私聊无cd，白名单群组无cd和次数限制
		if (!context.group_id) limit.cd = 0;
		else return;
		//else if (setting.setu.whiteGroup.includes(context.group_id)) pass = true;
		//if (!pass && !logger.canSearch(context.user_id, limit, 'setu')) {
		//	replyMsg(context, "乖，要懂得节制噢 →_→");
		//	return;
		//}

		getSetu().then(ret => {
			if (ret) {
				replyMsg(context, ret.url);
				replyMsg(context, CQcode.img(ret.file));
			} else replyMsg(context, '瑟图服务器爆炸惹_(:3」∠)_');
		});
		return true;
	}
	return false;
}
