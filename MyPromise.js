// 声明三种状态
const PENDING = 'PENDING',
  FULLFILLED = 'FULLFILLED',
  REJECTED = 'REJECTED';

class MyPromise {
  // new Promise(excutor)
  // excutor其实相当于传进了Promise的构造函数
  constructor(excutor) {
    // 为Promise初始化状态
    this.status = PENDING
    // 为resolve和reject函数设置参数
    this.value = undefined;
    this.reason = undefined;
    
    // 如果有多个then，需要依次执行onFulfilled或onRejected --- 收集回调
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    // 定义resolve和reject函数
    // 每个promise的excutor里都应该有自己的resolve和reject，所以不能定义在外面，外面相当于定义在了prototype上
    const resolve = (value) => {
      if (this.status === PENDING) {
        this.status = FULLFILLED;
        this.value = value

        // 异步的resolve或reject，先在pending时存到数组里，时间到了执行resolve时一起执行：
        this.onFulfilledCallbacks.forEach(fn => fn())
      }
    }
    const reject = (reason) => {
      if (this.status === PENDING) {
        this.status = REJECTED;
        this.reason = reason

        this.onRejectedCallbacks.forEach(fn => fn())
      }
    }

    // excutor执行过程中若抛出错误，要走onReject
    try {
      excutor
    } catch (e) {
      reject(e)
    }

    // excutor在new的时候就会执行
    excutor(resolve, reject);
  }
  // 方法定义在这里，相当于定义在prototype上, 也就是都继承一个这个方法
  // then接收参数为成功和失败回调
  then(onFulfilled, onRejected) {
    // onFulfilled和onRejected都是可选的，这里设默认值，否则报错
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
    onRejected = typeof onRejected === 'function' ? onRejected : reason => {throw reason}
    // then方法必须返回一个新的Promise
    // let promise2 = promise1.then(onFulFilled, onRejected)
    let promise2 = new Promise((resolve, reject) => {
      // onFulfilled 和 onRejected 执行完成后，都会返回x --- 来自文档
      // x 有可能是普通值，也可能是Promise，保存x是为了单独处理。(也可能会抛出异常)
      // 如果是promise，需要将promise的结果通过resolve、reject的结果或原因传给下一个then
      
      // 无论是成功回调还是失败回调抛出了错误，都必须将reason传给下一个promise的rejected
      if (this.status === FULLFILLED) {
        // onFulfilled和onRejected必须是异步的，不能阻塞其他的，这样才能在resolvePromise中拿到promise2
        // 官方建议使用宏任务方式：setTimeout、setImmediate，或微任务方式（MutationObserver、process.nextTick
        // 源码是微任务，这里用宏任务做
        // 包一层setTimeout，不阻塞，就可以在resolvePromise中拿到promise2的值
        setTimeout(() => {
          // onResolve回调中有可能抛出异常：
          try {
            let x = onFulfilled(this.value)
            // resolvePromise：专门处理x，区分普通值和Promise
            // 把promise2传进去，因为promise2的成功失败是不知道的，不知道要走resolve还是reject，并把resolve, reject传进去
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e)
          }
          // 设置为0，会大于等于4ms
          // 因为：函数的调用会在延迟之后发生，0意味着尽快执行，最小延迟>=4ms
        }, 0);
      }
  
      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            let x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e)
          }
        }, 0);
      }
  
      if (this.status === PENDING) {
        // pendding状态不需要包setTimeout延时，因为resolve或reject才会执行数组中的方法

        // 如果有多个promise.then，需要依次执行onFulfilled或onRejected
        // 收集成功或失败回调
        // 订阅：
        this.onFulfilledCallbacks.push(() => {
          // 包一层箭头函数，因为执行的时候要传value
          try {
            let x = onFulfilled(this.value)
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e)
          }
        })
        this.onRejectedCallbacks.push(() => {
          try {
            let x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e)
          }
        })
      }
    })

    return promise2;
  }

  // catch就是then的语法糖
  // catch相当于then(null, () => {})
  catch (errorCallback) {
    return this.then(null, errorCallback)
  }
  
}

function resolvePromise(promise2, x, resolve, reject) {
  // promise和x如果一用的是同一个对象 --- reject promise，typeError
  if (promise2 === x) {
    return reject(new Error('Chaining cycle detected for promise #<Promise>'))
  }

  // 记录是否调用：若状态已经改变过了，就不再调用，避免重复调用成功或失败的回调函数
  let called = false;
  // 如果x是object或function --- x可能是promise --- 判断then是否是函数 --- 确定是否是promise(鸭子类型)
  if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
    // 取then属性值的时候可能会throw error，比如在defineProperty的get中劫持并throw Error
    // 所以要包try
    try {
      let then = x.then
      if (typeof then === 'function') { // 鸭子类型认为是promise
        // 执行then方法：将then的this指向设为x（promise实例）,给then传入两个参数：成功回调和失败回调
        then.call(x, (y) => {
          // 避免重复调用成功或失败的回调函数
          if (called) return;
          called = true

          // resolve(y)
          // 要改成递归，因为resolve的回调中有可能还会resolve新的promise，又要重新处理
          resolvePromise(promise2, y, resolve, reject)
        }, (r) => {
          if (called) return;
          called = true
          reject(r)
        })
      }
    } catch (e) {
      reject(e)
    }
  } else { // 普通值
    if (called) return;
    called = true
    resolve(x)
  }

}

module.exports = MyPromise;

// catch在源码层面上就是一个then，catch也遵循then的运行原则

// then成功的条件：
// then return 普通的JavaScript值
// then return 新的promise成功态 value

// 失败条件：
// then return 新的promise失败态 reason
// then中throw异常 throw new Error

// 链式调用：
// 不能return this (Promise中没有this)
// 方案：返回了新的Promise
