import React from 'react';
import './App.css';

import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

const basicTest = createMachine(
  {
    id: 'basicTest',
    initial: 'pending',
    states: {
      pending: {
        on: {
          RESOLVE: {
            target: 'resolved',
            actions: ['announce'],
          },
          REJECT: {
            target: 'rejected',
          },
        },
      },
      resolved: {
        type: 'final',
      },
      rejected: {
        type: 'final',
      },
    },
  },
  {
    actions: {
      announce: (ctx, event) => {
        console.log('ann', event);
      },
    },
  }
);

const invokeTestPromiseFn = () => {
  return new Promise((yes, no) => {
    setTimeout(() => yes('done'), 1000);
  });
};

const invokeTest = createMachine<{ res: string }>(
  {
    id: 'invokeTest',
    initial: 'idle',
    schema: {
      context: {
        res: '',
      } as { res: string },
    },
    states: {
      doit: {
        invoke: {
          id: 'useless',
          src: invokeTestPromiseFn,
          onDone: {
            actions: [
              assign({
                res: (_, ev) => ev.data,
              }),
              'end',
            ],
          },
        },
      },
      idle: {
        on: {
          DOIT: {
            target: 'doit',
          },
        },
      },
      success: {},
    },
  },
  {
    actions: {
      end: (ctx, event) => console.log('aewfaewf', ctx, event),
    },
  }
);

function App() {
  const [basicState, basicSend] = useMachine(basicTest);
  const [invokeState, invokeSend] = useMachine(invokeTest);

  return (
    <div className="App">
      <div>{JSON.stringify(basicState.value)}</div>
      <button onClick={() => basicSend('RESOLVE')}>doit</button>
      <div>{JSON.stringify(invokeState.value)}</div>
      <button onClick={() => invokeSend('DOIT')}>doit</button>
    </div>
  );
}

export default App;
