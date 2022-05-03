import { l as lib, _ as __awaiter } from './vendors.js';
import { TextDecoderStream, TextEncoderStream } from 'text-encode-transform';
import { createResponse } from 'create-response';
import { httpRequest } from 'http-request';
import { logger } from 'log';
import { TransformStream } from 'streams';

class HTMLRewriterStream extends TransformStream {
    constructor(handlers, ...args) {
        const rewriter = new lib();
        for (const key of Object.keys(handlers)) {
            rewriter.on(key, (...args) => handlers[key](rewriter, ...args));
        }
        super({
            start(controller) {
                rewriter.on("data", chunk => controller.enqueue(chunk));
                rewriter.on("close", () => controller.terminate());
            },
            transform(chunk) {
                rewriter.write(chunk);
            },
            flush(controller) {
                rewriter.end();
            }
        }, ...args);
    }
}

class BodyOnly extends HTMLRewriterStream {
    constructor( ...args) {
	this.emit = 0;
        super({
            startTag: (emitter, startTag, raw) => {
                if (startTag.tagName.equals('body')) {
			this.emit = 1;
			emitter.emitRaw("startofbody")
                }
                if (this.emit) {
                   emitter.emitRaw(raw);
		}
            },
            text(emitter, text, raw) {
                if (this.emit) {
                   emitter.emitRaw(raw);
		}
            },
            endTag: (emitter, endTag, raw) => {
                if (this.emit) {
                	emitter.emitRaw(raw);
		}
            },
        }, ...args);
    }
}

class HeadOnly extends HTMLRewriterStream {
    constructor(...args) {
	this.emit = 1;
        super({
            startTag: (emitter, startTag, raw) => {
                if (this.emit) {
                   emitter.emitRaw(raw);
		}
            },
            text(emitter, text, raw) {
                if (this.emit) {
                   emitter.emitRaw(raw);
		}
            },
            endTag: (emitter, endTag, raw) => {
                if (this.emit) {
                	emitter.emitRaw(raw);
		}
                if (endTag.tagName.equals('head')) {
			this.emit = 0;
			emitter.emitRaw("end of head")
                }
            },
        }, ...args);
    }
}

function concatenateReadables(promiseOne, promiseTwo ) {
  
  let outStream = new TextEncoderStream();
  promiseOne.then(
      response => { 
          response.body
            .pipeThrough(new TextDecoderStream(), { preventClose: true })
            .pipeThrough(new HeadOnly(), { preventClose: true })
	    .pipeThrough(outStream, { preventClose: true })
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
                response.body
                    .pipeThrough(new TextDecoderStream())
                    .pipeThrough(new BodyOnly())
		    .pipeThrough(outStream)
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

export function responseProvider(request) {

    let options = {}
    options.headers = { "X-NO-ESI": "true" }

    let promiseOne = httpRequest(`${request.scheme}://${request.host}/${request.url}`, options)
    let promiseTwo = httpRequest(`${request.scheme}://${request.host}/${request.url}`)

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

