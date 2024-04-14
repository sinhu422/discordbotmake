const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS, // 서버 정보
        Intents.FLAGS.GUILD_MESSAGES, // 서버 메시지 수신
        // 필요한 다른 Intents 추가
    ] 
});

const token = 'MTIyODcyNDIxNDIwMzE1NDQ4Mg.GuyARi.FQYiYRSFQRmVLv5vBjDpvXCWDKJSXrGjOa53dQ';
const prefix = '!';

const queue = new Map();
const users = {};
const stocks = {
    '삼생': { price: 1000 },
    '애뽈': { price: 1500 },
    '엘쥐': { price: 2000 },
    'ZKT': { price: 1200 },
    '부리츠': { price: 800 },
    '레알마드리드': { price: 2340000 },
};

client.once('ready', () => {
    console.log(`${client.user.tag}이(가) 로그인하였습니다.`);
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '메시지청소') {
        const amount = parseInt(args[0]) + 1;

        if (isNaN(amount)) {
            return message.reply('올바른 숫자를 입력하세요.');
        } else if (amount <= 1 || amount > 100) {
            return message.reply('1에서 99 사이의 숫자를 입력하세요.');
        }

        message.channel.bulkDelete(amount, true).catch(err => {
            console.error(err);
            message.channel.send('메시지를 삭제하는 동안 오류가 발생했습니다.');
        });
    }

    if (command === '도박') {
        gamble(message, args);
        return;
    }

    if (command === '주식') {
        checkStock(message, args);
        return;
    }

    if (command === '주식구매') {
        buyStock(message, args);
        return;
    }

    if (command === '주식판매') {
        sellStock(message, args);
        return;
    }

    if (command === '돈') {
        checkBalance(message);
        return;
    }

    if (command === '재생') {
        execute(message, queue);
        return;
    }

    if (command === '스킵') {
        skip(message, queue);
        return;
    }

    if (command === '정지') {
        stop(message, queue);
        return;
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(' ');
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel)
        return message.channel.send(
            '음악을 재생하기 위해서는 음성 채널에 참여하여야 합니다.'
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send(
            '접속 및 발언 권한이 필요합니다.'
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} 이(가) 대기열에 추가되었습니다.`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            '음악을 스킵하려면 음성 채널에 참여하여야 합니다.'
        );
    if (!serverQueue)
        return message.channel.send('스킵할 곡이 없습니다.');
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            '음악을 중지하려면 음성 채널에 참여하여야 합니다.'
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on('finish', () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`재생 중: **${song.title}**`);
}

function checkStock(message, args) {
    const stockSymbol = args[0];

    if (!stockSymbol) {
        return message.channel.send('주식 심볼을 입력하세요.');
    }

    const stock = stocks[stockSymbol.toUpperCase()];
    if (!stock) {
        return message.channel.send('해당 주식이 존재하지 않습니다.');
    }

    message.channel.send(`주식 정보 - ${stockSymbol}:
    현재 가격: $${stock.price}`);
}

// 주식 가격 업데이트 함수
function updateStockPrices() {
    for (const symbol in stocks) {
        const stock = stocks[symbol];
        // 주식 가격을 현재 가격의 ±5% 범위 내에서 무작위로 조정
        const change = Math.random() * (stock.price * 0.05);
        const direction = Math.random() < 0.5 ? -1 : 1;
        stock.price += change * direction;
    }
}

// 5초마다 주식 가격 업데이트
setInterval(updateStockPrices, 60000);

function buyStock(message, args) {
    const user = message.author;
    const stockSymbol = args[0];
    const amount = parseInt(args[1]);

    if (!stockSymbol || !amount) {
        return message.channel.send('주식 심볼과 수량을 입력하세요.');
    }

    const stock = stocks[stockSymbol.toUpperCase()];
    if (!stock) {
        return message.channel.send('해당 주식이 존재하지 않습니다.');
    }

    const totalPrice = amount * stock.price;
    if (users[user.id] < totalPrice) {
        return message.reply('잔고가 부족합니다.');
    }

    users[user.id] -= totalPrice;
    message.channel.send(`${user.username}님이 ${amount}주의 ${stockSymbol} 주식을 $${totalPrice}에 구매하였습니다.`);
}

function sellStock(message, args) {
    const user = message.author;
    const stockSymbol = args[0];
    const amount = parseInt(args[1]);

    if (!stockSymbol || !amount) {
        return message.channel.send('주식 심볼과 수량을 입력하세요.');
    }

    const stock = stocks[stockSymbol.toUpperCase()];
    if (!stock) {
return message.channel.send('해당 주식이 존재하지 않습니다.');
}

const totalPrice = amount * stock.price;
users[user.id] += totalPrice;
message.channel.send(`${user.username}님이 ${amount}주의 ${stockSymbol} 주식을 $${totalPrice}에 판매하였습니다.`);
}

// 주식 가격을 업데이트하는 함수
function updateStockPrices() {
    for (const symbol in stocks) {
        const stock = stocks[symbol];
        // 주식 가격을 현재 가격의 ±5% 범위 내에서 무작위로 조정
        const change = Math.random() * (stock.price * 0.05);
        const direction = Math.random() < 0.5 ? -1 : 1;
        stock.price += change * direction;
    }
    // 업데이트된 주식 가격을 확인하기 위해 콘솔에 로그 출력
    console.log('주식 가격이 업데이트되었습니다.');
}

// 1분마다 주식 가격 업데이트
setInterval(updateStockPrices, 60000); // 1분(60초) = 60000밀리초

function gamble(message, args) {
const user = message.author;
const betAmount = parseInt(args[0]);

if (isNaN(betAmount)) {
    return message.channel.send('올바른 금액을 입력하세요.');
}

if (users[user.id] < betAmount) {
    return message.reply('잔고가 부족합니다.');
}

const randomNumber = Math.random();
if (randomNumber > 0.5) {
    users[user.id] += betAmount;
    message.channel.send(`${user.username}님이 $${betAmount}를 벌었습니다!`);
} else {
    users[user.id] -= betAmount;
    message.channel.send(`${user.username}님이 $${betAmount}를 잃었습니다.`);
}
}

function checkBalance(message) {
const user = message.author;
const balance = users[user.id] || 0;
message.channel.send(`${user.username}님의 잔고: $${balance}`);
}

// 사용자별 마지막 돈을 받은 시간 저장 객체
const lastMoneyReceived = {};

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 돈받기 명령어
    if (command === '돈받기') {
        const cooldownTime = 60 * 60 * 100; // 1시간 (단위: 밀리초)
        const now = Date.now();
        const lastReceivedTime = lastMoneyReceived[message.author.id] || 0;

        if (now - lastReceivedTime < cooldownTime) {
            const remainingTime = cooldownTime - (now - lastReceivedTime);
            const remainingHours = Math.floor(remainingTime / (60 * 60 * 100));
            const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 100)) / (60 * 100));
            return message.channel.send(`아직 돈을 받을 수 없습니다. 다음 돈을 받을 수 있는 시간: ${remainingHours}시간 ${remainingMinutes}분`);
        }

        // 돈을 받고 마지막 돈을 받은 시간을 업데이트
        const amount = 1500; // 받을 돈의 양
        users[message.author.id] += amount;
        lastMoneyReceived[message.author.id] = now;
        message.channel.send(`${message.author.username}님이 $${amount}를 받았습니다.`);
        return;
    }

    // 다른 명령어들...
});

client.on('messageCreate', async message => {
    if (message.content === '!주식목록') {
        let stockList = '```\n주식 종목 목록:\n';
        let counter = 0; // 카운터 초기화
        for (const symbol in stocks) {
            const stock = stocks[symbol];
            // 소수를 제거하여 정수로 표시
            const priceWithoutDecimal = Math.floor(stock.price);
            stockList += `${symbol}: 현재 가격 $${priceWithoutDecimal}\n`;
            counter++; // 카운터 증가
            // 카운터가 3의 배수이면 줄 바꿈
            if (counter % 3 === 0) {
                stockList += '\n';
            }
        }
        stockList += '```\n'; // 코드 블록 닫기
        message.channel.send(stockList);
    }
    // 다른 코드...
});

client.login(token);