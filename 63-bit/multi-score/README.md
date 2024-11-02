## decision making market 实验代码

### 代码设计
合约遵循论文中的结构
电路使用字节串把同一个投票人的多个选项放在一个数里面做证明（aggraged_x）位拼接的方式

x1 || x2 || x3 || x4

这样可以满足加法同态（拼起来加 加完再拼 只要不会overflow就可以）

*不满足乘法，没有办法算 y的几何平均*



### 代码结构：

- build
build.sh 完成可信启动，编译电路。同时将模版文件中的值替换成实际的值（使用sed -i.bak)

build.sh -n 2000  -m 4  -s 16 n是总的参与人数，m是候选人数，s是投票上限分数



-src
    - genVoter.js 生成投票者并持久化
    - voter.js 投票者（随机生成投票数据、证明）
    - puzzle.js HTLP 的setup 还有PoSW的生成

- test
主要测试代码

- circuits
电路代码 主要是范围和 加和的认证