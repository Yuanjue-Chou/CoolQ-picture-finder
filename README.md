# CoolQ-picture-finder
[酷Q机器人](https://cqp.cc/forum.php)用图片/番剧/本子搜索机器人
## 原作者：https://github.com/Tsuk1ko/CQ-picfinder-robot
<br>
我只是把原来的逻辑改成了我需要的，绝大多数部分都是照搬的
虽然还是恬不知耻地上传了，但我还是想感谢一下原作者。
传上来的主要原因，一个是存档，还有一个
<br>
原README对我这种没接触过nodejs的人来说真心有点难理解，所以也算给自己留一个笔记
<br>
### 使用方法：
主要部分详见原作者的README。
<br>
### 补充部分：
<br>
我的环境是windows 2008 R2服务器
整个插件大致就是依靠酷Q的一个内部的http api插件来实现用WebSocket的接口连上外面的程序（虽然我已经搭上去了，但并没去琢磨过nodejs是啥，只知道是js结尾的，应该是脚本。。。。）
<br>
#### 1.先搭nodejs的环境……
<br>
#### 2.内部插件部分：
虽说原作者甩了那个内部插件的[原址](https://github.com/richardchien/coolq-http-api), 其实不需要管这么多，直接下里面的插件丢到./app里去就好了
<br>
#### 3.http-api配置：
原作者说看插件说明书不赘述的地方，成了我卡的时间最长的地方。运行了这个插件之后，会在app\io.github.richardchien.coolqhttpapi\里生成一个已QQ号命名的配置文件。里面需要用的只有WebSocket，所以只需要把use_ws改成true，ws_host改成自己服务器的内网IP，内网IP，内网IP！设成外网的我就这样瞎折腾了大半天.....
<br>
#### 4.原机器人的设置（config.json）:
核心只有一个host，改成内网。然后QQ号必改。里面那个admin不加也能跑
<br>
<br>
##### 其他的跟着原readme走就行了。主要就是：
1.下载插件部分：

git clone https://github.com/YKilin/CQ-picfinder-robot.git

cd CQ-picfinder-robot

cp config.json.default config.json

npm i
<br>
2.修改内外插件设置：就是那个qq命名的文件和刚说的机器人部分的config.json
<br>
3.启动部分：

#没有pm2先安装

npm install pm2 -g

#首次运行

pm2 start index.js --name="cqpf"

#运行

pm2 start cqpf

#停止

pm2 stop cqpf

#重启

pm2 restart cqpf

#查看日志

pm2 logs cqpf


##### 主要功能修改部分：
1.原来是一个启动指令之后，在结束指令之前，机器人会一直搜索该用户发送的图片。现在改成了搜索一张图片后自动关闭搜索，也就是一个指令一张。（鬼知道那些群里的会不会记得关掉）

2.色图功能直接不能在群里用，私聊永久有效

3.私聊时没法图片时，默认不发提示。毕竟机器人一般都不会只有一个插件，消息里没图不能直接当非正常消息处理

4.启动搜索时，给出提示：“少女祈祷中……”。对，我他喵的就是东方众


ps：config.json.default是原始设置的备份，其他代码也都在了。
