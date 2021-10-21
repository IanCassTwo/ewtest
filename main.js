import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import { TransformStream } from 'streams';

function concatenateReadables(promiseOne, promiseTwo ) {
  
  let outStream = new TransformStream();
  promiseOne.then(
      response => { 
	response.body.pipeTo(outStream.writable, { preventClose: true })
      },
      reason => {
	return Promise.all([
	  outStream.writable.abort(reason),
	  promiseOne.cancel(reason)
	]);
      }
  ).then(() => {
	    promiseTwo.then(
	      response => { 
		response.body.pipeTo(outStream.writable, { preventClose: false })
	      },
	      reason => {
		return Promise.all([
		  outStream.writable.abort(reason),
		  promiseTwo.cancel(reason)
		]);
	      }
	  )
  });

  return outStream.readable;
}

export function responseProvider (request) {

    let promiseOne = httpRequest(`${request.scheme}://${request.host}/static/head.fragment`)
    let promiseTwo = httpRequest(`${request.scheme}://${request.host}${request.url}`)

    return Promise.resolve(
	createResponse(
		200,
		{ 
			'Powered-By': ['Akamai EdgeWorkers'] 
		},
		concatenateReadables(promiseOne, promiseTwo)
	)
    );
}
