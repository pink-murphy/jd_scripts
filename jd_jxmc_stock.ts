/**
 * 京喜牧场兑换新品通知
 * 推送新上商品
 * cron: 0 * * * *
 */

import axios from 'axios';
import {requireConfig, requestAlgo, decrypt, getJxToken, wait, getRandomNumberByRange} from './TS_USER_AGENTS';
import {readFileSync, writeFileSync, accessSync} from "fs";

const notify = require('./sendNotify')
let cookie: string = '', res: any = '', UserName: string;

!(async () => {
  await requestAlgo();
  let cookiesArr: any = await requireConfig();
  cookie = cookiesArr[getRandomNumberByRange(0, cookiesArr.length)];
  UserName = decodeURIComponent(cookie.match(/pt_pin=([^;]*)/)![1])
  try {
    accessSync('./jxmc_stock.json')
  } catch (e) {
    writeFileSync('./jxmc_stock.json', '{}', 'utf-8')
  }
  let exist: any = JSON.parse(readFileSync('./jxmc_stock.json', 'utf-8'))
  let items: string = '', message: string = '', token = getJxToken(cookie);
  res = await api('queryservice/GetGoodsListV2',
    'activeid,activekey,channel,jxmc_jstoken,phoneid,sceneid,timestamp', {
      activeid: 'jxmc_active_0001',
      activekey: 'null',
      jxmc_jstoken: token.strPgUUNum,
      timestamp: token.strPgtimestamp,
      phoneid: token.strPhoneID
    })

  await wait(2000);

  for (let good of res.data.goodslist) {
    if (!Object.keys(exist).includes(good.prizepool)) {
      items += good.prizepool + ','
      exist[good.prizepool] = {
        id: good.prizepool,
        egg: good.neednum
      }
    }
  }
  let allItems: string = items;
  if (items) {
    let arr: string[] = items.split(',');
    arr.pop();
    items = '';
    let result = [];
    for (let i = 0, len = arr.length; i < len; i += 30) {
      result.push(arr.slice(i, i + 30))
    }
    for (let group of result) {
      for (let id of group) {
        items += id + ','
      }
      res = await getEgg(items)
      await wait(1000)
      for (let t of res.result) {
        console.log(t.prizes[0].Name)
        exist[t.active].name = t.prizes[0].Name
      }
      items = ''
    }
  }
  writeFileSync('./jxmc_stock.json', JSON.stringify(exist, null, 2), 'utf-8')
  for (let j of Object.keys(exist)) {
    if (allItems.indexOf(j) > -1) {
      message += exist[j].name + '\t' + exist[j].egg + '\n'
    }
  }
  if (message) {
    await notify.sendNotify('京喜牧场兑换', message)
  }
  console.log(exist)
})()

interface Params {
  isgift?: number,
  activeid?: string,
  activekey?: string,
  jxmc_jstoken?: string,
  timestamp?: string,
  phoneid?: string
}

function api(fn: string, stk: string, params: Params = {}) {
  return new Promise(async (resolve, reject) => {
    let url = `https://m.jingxi.com/jxmc/${fn}?channel=7&sceneid=1001&_stk=${encodeURIComponent(stk)}&_ste=1&sceneval=2`
    if (Object.keys(params).length !== 0) {
      let key: (keyof Params)
      for (key in params) {
        if (params.hasOwnProperty(key))
          url += `&${key}=${params[key]}`
      }
    }
    url += '&h5st=' + decrypt(stk, url)
    try {
      let {data} = await axios.get(url, {
        headers: {
          'Cookie': cookie,
          'Host': 'm.jingxi.com',
          'User-Agent': 'jdpingou;',
          'Referer': 'https://st.jingxi.com/',
        }
      })
      resolve(data)
    } catch (e) {
      reject(401)
    }
  })
}

function getEgg(items: string) {
  items = items.substr(0, items.length - 1)
  let rnd = "abcdefhijkmnprstwxyz".charAt(Math.floor(Math.random() * 4)).toUpperCase();
  return new Promise(async resolve => {
    let {data} = await axios.get(`https://m.jingxi.com/active/queryprizedetails?actives=${items}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBK${rnd}&g_ty=ls`, {
      headers: {
        'Cookie': cookie,
        'Host': 'm.jingxi.com',
        'User-Agent': 'jdpingou;',
        'Referer': 'https://st.jingxi.com/pingou/jxmc/index.html',
      }
    })
    data = JSON.parse(data.replace(`try{ jsonpCBK${rnd}(`, '').replace(');}catch(e){}', ''))
    resolve(data)
  })
}