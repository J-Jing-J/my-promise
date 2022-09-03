// new Promise是，excutor会自动执行
let promise = new Promise((resolve, reject) => {
  reject('Error')
})

// 如果有多个promise.then，需要依次执行onFulfilled或onRejected
promise.then((value) => {
  console.log('FullFilled' + value);
}, (reason) => {
  console.log('Rejected' + reason);
})

promise.then((value) => {
  console.log('FullFilled' + value);
}, (reason) => {
  console.log('Rejected' + reason);
})