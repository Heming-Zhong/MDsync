# 客户端描述

## 技术

基于Electron+nodejs实现

## 文件结构

- 前端：
    - index.html: 登录页面
    - index.css: 登录页面样式
    - main.html: 主页面
    - main.css: 主页面样式
    - md.css: 主页面使用的Markdown样式
    - tui-editor: 构成主页Markdown编辑器的相关代码。来源：https://github.com/nhn/tui.editor

- 后端：
    - main.js: Electron主进程代码
    - proto.js: 处理protobuf的代码模块
    - client-encrypt.js: 客户端登录加密模块(已弃用)
    - mdsync.proto: 用于通信的protobuf文件
    - rpc.js: 用于获取grpc通信存根的模块

## 测试与运行

首先安装依赖，在client下输入：

```shell
npm install
```

然后启动客户端，在client目录下输入：

```shell
electron main.js
```

或 

```shell
npm start
```


