import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import { TransformStream } from 'streams';


function concatenateReadables(promiseOne, promiseTwo ) {
  
  let outStream = new TransformStream();
  let promise = Promise.resolve();

    // fixme DRY
    promise = promiseOne.then(
      response => { 
        response.body.pipeTo(outStream.writable, { preventClose: true })
      },
      reason => {
        return Promise.all([
          outStream.writable.abort(reason),
          promiseOne.cancel(reason)
        ]);
      }
    );

    promise = promiseTwo.then(
      response => { 
        response.body.pipeTo(outStream.writable, { preventClose: true })
      },
      reason => {
        return Promise.all([
          outStream.writable.abort(reason),
          promiseTwo.cancel(reason)
        ]);
      }
  );

  promise.then(() => {
    outStream.writable.close();
  });

  return outStream.readable;
}

export async function responseProvider (request) {

    let promiseOne = httpRequest(`${request.scheme}://${request.host}${request.url}`)
    let promiseTwo = httpRequest(`${request.scheme}://${request.host}/static/head.fragment`)

    return createResponse(
	200,
	{ 
		'Powered-By': ['Akamai EdgeWorkers'] 
	},
	concatenateReadables(promiseOne, promiseTwo)
    );
}
