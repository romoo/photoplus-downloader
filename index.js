const fs = require('fs');
const md5 = require('js-md5');
const axios = require('axios');
const cli = require('cac')();
const cliProgress = require('cli-progress');

const SALT = 'laxiaoheiwu';
const COUNT = 9999;

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
let remain = 0;

const data = {
  activityNo: 0,
  isNew: false,
  count: COUNT,
  page: 1,
  ppSign: 'live',
  picUpIndex: '',
  _t: 0,
};

const updateProgress = () => {
  bar.update(data.count - remain);
  if (remain === 0) {
    bar.stop();
  }
};

const downloadImage = (url, imagePath) => {
  const isExist = fs.existsSync(imagePath);
  if (isExist) {
    remain -= 1;
    updateProgress();
    // console.log(`${imagePath} - exist`);
    return;
  }
  axios({
    url,
    responseType: 'stream',
  }).then((response) => new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(imagePath))
      .on('finish', () => {
        // console.log(`${imagePath} - done`);
        remain -= 1;
        updateProgress();
        resolve();
      })
      .on('error', (e) => {
        remain -= 1;
        updateProgress();
        reject(e);
      });
  }));
};

const objKeySort = (obj) => {
  const oldObj = obj;
  const newKey = Object.keys(oldObj).sort();
  let newObj = '';
  for (let i = 0; i < newKey.length; i += 1) {
    if (oldObj[newKey[i]] !== null) {
      oldObj[newKey[i]] = JSON.stringify(oldObj[newKey[i]]);
      newObj = `${newObj}${newObj.includes('=') ? '&' : ''}${newKey[i]}=${oldObj[newKey[i]]}`;
    }
  }
  return newObj;
};

const downloadAllImages = (list, dir) => {
  const sendArr = [];
  list.forEach((item) => {
    const url = `https:${item.origin_img}`;
    const fileName = url.split('/').pop().split('#')[0].split('?')[0];
    sendArr.push(downloadImage(url, `${dir}/${fileName}`));
  });
  axios.all(sendArr);
};

const startProgress = () => {
  bar.start(data.count, 0, {
    speed: 'N/A',
  });
  remain = data.count;
};

const getAllImages = (id) => {
  const t = +new Date();
  const dir = `./dist/${id}`;
  data.activityNo = id;
  // eslint-disable-next-line no-underscore-dangle
  data._t = t;
  const dataSort = objKeySort(data).replace(/"/g, '');
  const sign = md5(dataSort + SALT, 32);
  const params = {
    ...data,
    _s: sign,
    ppSign: 'live',
    picUpIndex: '',
  };

  axios.get('https://live.photoplus.cn/pic/pics', {
    params,
  }).then((res) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const { result } = res.data;
    console.log(`Total photos: ${result.pics_total}, download: ${data.count}`);
    startProgress();
    downloadAllImages(result.pics_array, dir);
  });
};

cli.option('--id <id>', 'photoplus ID (eg: 87654321)', {});
cli.option('--count <count>', 'number of photos', {
  default: `${COUNT}`,
});
cli.help();

const parsed = cli.parse();
const count = Number(parsed.options.count);
const id = Number(parsed.options.id);
if (Number.isInteger(count)) {
  data.count = Number(count);
}
if (Number.isInteger(id)) {
  getAllImages(id);
} else {
  console.log('Wrong ID');
}
