// 依赖引入
const jsdom = require('jsdom');
const https = require('https');
const fs = require('fs');
const zlib = require('zlib');
const { JSDOM } = jsdom;

const chan = process.argv[2]; // 串号

let str = ''; // 最终导出到txt的字符串
let page = 1; // 页码初始化

if (!chan.match(/^[0-9]+$/)) {
  console.log(`正在下载: ${chan}`);
  // console.error('串号输入有误，请输入纯数字的串号，如：31163008');
  // process.exit(0);
} else {
  console.log(`正在下载: No.${chan}`);
}

// 将请求的 option 转为函数, 实现翻页时 options.path 的 page 动态变化


// 备胎岛
// const options = (page) => {
//   host: "tnmb.org",
//   port: 443,
//   path: `/t/${chan}?page=${page}`,
// };
function wait(ms) {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
};
// 最外层的 pre_req 用于获取最大页码
const thread_req = (c) => {
  const options = page => {
    return {
      host: 'adnmb3.com',
      port: 443,
      path: `/t/${c}?page=${page}`,
    };
  };
  return https.request(options(1), async res => {
    await wait(Math.random()*2000);
    if (res.statusCode === 502) {
      console.log('岛沉了，告辞');
    } else if (res.statusCode === 200) {
      console.log(`状态码: ${res.statusCode}, 开始获取索引`);
      let buffArr = [];
      let buff = null;
      res.on('data', d => {
        buffArr.length += 1;
        buffArr[buffArr.length - 1] = d;
      });
      res.on('end', () => {
        // 防止网站连续提供2个Buffer造成的报错
        buffArr.length > 1 ? (buff = Buffer.concat(buffArr)) : (buff = buffArr[0]);
        // gunzip用于解压缩gzip编码
        zlib.gunzip(buff, async function (err, decoded) {
          let html = decoded.toString();
          const dom = new JSDOM(html);
          // 判断是否只有一页
          let page_first = dom.window.document.querySelector('.uk-pagination li:last-child').getAttribute('class');
          if (page_first === 'uk-disabled') {
            page = 1;
          } else {
            // 获取[末页]按钮的实际跳转页数
            let page_str = dom.window.document
              .querySelector('.uk-pagination li:last-child a')
              .getAttribute('href')
              .match(/.+page=(.+)/)[1];
            page = parseInt(page_str);
            // 如果跳转页数为2，那么获取到的不是[末页]按钮，而是下一页，
            // 那么倒数第二个页码按钮为最大页数
            if (page === 2) {
              page_str = dom.window.document
                .querySelector('.uk-pagination li:nth-last-child(2) a')
                .getAttribute('href')
                .match(/.+page=(.+)/)[1];
              page = parseInt(page_str);
            }
          }
          console.log('thread page: ', page);
          // 等待所有页轮询完成
          await threadTurner(page,options);
          // 写入文件
          fs.mkdir('./download', { recursive: true }, err => {
            if (err) console.log(err);
          });
          fs.writeFile(`./download/No.${c}.txt`, str, function () {
            // console.log('str: ', str);
            console.log(`下载完成！保存在 ./download/No.${c}.txt`);
          });
        });
      });
    } else {
      console.log('出啥情况啦？咱也不造啊|д`)', res.statusCode,c);
    }
  });
};

const foptions = (page) => {
  return {
  host:'adnmb3.com',
  port: 443,
  path: `/f/${encodeURIComponent(chan)}?page=${page}`,
  }
};

const download_threads = https.request(foptions(1), res => {
  if (res.statusCode === 502) {
    console.log('岛沉了，告辞');
  } else if (res.statusCode === 200) {
    console.log(`状态码: ${res.statusCode}, 开始获取索引`);
    let buffArr = [];
    let buff = null;
    res.on('data', d => {
      buffArr.length += 1;
      buffArr[buffArr.length - 1] = d;
    });
    res.on('end', () => {
      // 防止网站连续提供2个Buffer造成的报错
      buffArr.length > 1 ? (buff = Buffer.concat(buffArr)) : (buff = buffArr[0]);
      // gunzip用于解压缩gzip编码
      zlib.gunzip(buff, async function (err, decoded) {
        let html = decoded.toString();
        const dom = new JSDOM(html);

        // 获取[末页]按钮的实际跳转页数
        let page_str = dom.window.document
          .querySelector('.uk-pagination li:last-child a')
          .getAttribute('href')
          .match(/.+page=(.+)/)[1];
        page = parseInt(page_str);
        // 如果跳转页数为2，那么获取到的不是[末页]按钮，而是下一页，
        // 那么倒数第二个页码按钮为最大页数
        if (page === 2) {
          page_str = dom.window.document
            .querySelector('.uk-pagination li:nth-last-child(2) a')
            .getAttribute('href')
            .match(/.+page=(.+)/)[1];
          page = parseInt(page_str);
        }
        console.log('page: ', page);
        await pageTurner(page);
      });
    });
  } else {
    console.log('出啥情况啦？咱也不造啊|д`)', res.statusCode);
  }
});

download_threads.on('error', error => {
  console.error(error);
});

download_threads.end();
// 当前页所有楼层轮询器
const pageRowTurner = function (c,options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options(c), res => {
      let bufferArr = [];
      let buffer = null;
      res.on('data', d => {
        bufferArr.length += 1;
        bufferArr[bufferArr.length - 1] = d;
      });
      res.on('end', () => {
        // 防止网站连续提供2个Buffer造成的报错
        bufferArr.length > 1 ? (buffer = Buffer.concat(bufferArr)) : (buffer = bufferArr[0]);
        zlib.gunzip(buffer, function (err, decoded) {

          let html = decoded.toString();
          const dom = new JSDOM(html);

          let outArr = dom.window.document.querySelectorAll('.h-threads-content');
          let tidArr = dom.window.document.querySelectorAll('.h-threads-info-id'); // 获取串号
          let offset = 0; // 广告层数偏移量修正
          outArr.forEach((i, index) => {
            let tid = tidArr[index].textContent;
            if (tid === 'No.9999999') {
              // 过滤广告
              offset++;
              // console.log(`已过滤 ${offset} 条广告`);
            } else {
              // console.log(i.textContent)
              // strArr[index] = i.textContent.replace(/ /gm,"")
              strOr = i.textContent.trim();
              // 条件判断当前楼层是否为当页主题层(第0层)，是的话显示 [x,po]
              index == 0 ? (row = `[${c}, po] ${tid}\n${strOr}\n`) : (row = `[${c}, ${index - offset}] ${tid}\n${strOr}\n`);
              str += row;
            }
          });
          if (err) {
            console.log('err: ', err);
          }
          resolve();
        });
      });
    });

    req.on('error', error => {
      console.error(error);
    });

    req.end();
  });
};

const threadsTurner = function (c) {
  return new Promise((resolve, reject) => {
    console.log('nowPage: ', c);
    const req = https.request(foptions(c), res => {
      let bufferArr = [];
      let buffer = null;
      res.on('data', d => {
        bufferArr.length += 1;
        bufferArr[bufferArr.length - 1] = d;
      });
      res.on('end', () => {
        // 防止网站连续提供2个Buffer造成的报错
        bufferArr.length > 1 ? (buffer = Buffer.concat(bufferArr)) : (buffer = bufferArr[0]);
        zlib.gunzip(buffer,(err, decoded) => {
          let html = decoded.toString();
          const dom = new JSDOM(html);

          let tidArr = dom.window.document.querySelectorAll('.h-threads-item'); // 获取串号

          tidArr.forEach(async (i, index) => {
            let tid = i.getAttribute('data-threads-id');
            console.log('downlaod thread',tid);
            let r = thread_req(tid);
            r.on('error', error => {
              console.error(error);
            });
            r.end();
            // await wait(1000);
          });
          if (err) {
            console.log('err: ', err);
          }
          resolve();
        });
      });
    });

    req.on('error', error => {
      console.error(error);
    });

    req.end();
  });
};

// 调用方法；
//当前版块的所有页轮询器
const pageTurner = async function (page) {
  for (let i = 1; i <= page; i++) {
    await threadsTurner(i);
    await wait(5000);

  }
};
// 当前串所有页轮询器
const threadTurner = async function (page,options) {
  for (let c = 1; c < page + 1; c++) {
    // 等待当前页所有回应（楼层）轮询完成
    await pageRowTurner(c,options);
    str += '\n\n\n\n';
  }
};
