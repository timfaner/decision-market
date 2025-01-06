const fs = require('fs');
const path = require('path');

// 模拟文件内容（实际使用时替换为你的文件路径）
const data = fs.readFileSync('puzzle_result.txt', 'utf8');

// 定义正则表达式来匹配 t、T1、T2 和 T3 以及各自的单位
const regex = /t: (\d+)\s+Puzzle initialization: ([\d.]+)(ms|s)?\s+LHTLPGen: ([\d.]+)(ms|s)?\s+solvePuzzle: ([\d:.]+)(ms|s|\(m:ss\.mmm\))?/g;

let results = [];
let match;

// 提取 t, T1, T2, T3 的值并统一为毫秒
while ((match = regex.exec(data)) !== null) {
    const t = parseInt(match[1]);

    // Puzzle initialization (T1)
    let T1 = parseFloat(match[2]);
    if (match[3] === 's') T1 *= 1000; // 秒转换为毫秒

    // LHTLPGen (T2)
    let T2 = parseFloat(match[4]);
    if (match[5] === 's') T2 *= 1000; // 秒转换为毫秒

    // solvePuzzle (T3)
    let T3;
    if (match[7] === 's') {
        T3 = parseFloat(match[6]) * 1000; // 秒转换为毫秒
    } else if (match[7] === '(m:ss.mmm)') {
        // 分钟:秒.毫秒格式转换为毫秒
        const [minutes, secondsMilliseconds] = match[6].split(':');
        const [seconds, milliseconds] = secondsMilliseconds.split('.');
        T3 = parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds);
    } else {
        // 默认处理毫秒 (ms)
        T3 = parseFloat(match[6]);
    }

    results.push({ t, T1, T2, T3 });
}

// 准备 CSV 文件内容
let csvContent = "t,T1,T2,T3\n"; // 添加表头
results.forEach(row => {
    csvContent += `${row.t},${row.T1},${row.T2},${row.T3}\n`;
});

// 写入 CSV 文件
fs.writeFileSync(path.join(__dirname, 'puzzle_result.csv'), csvContent);

console.log('Data has been saved to puzzle_result.csv');
