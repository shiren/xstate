import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

import { useEffect } from 'react';

const postPurchase = (cart) =>
  new Promise((res) => {
    setTimeout(() => {
      res(true);
    }, 2000);
  });

const stateMachine = createMachine(
  {
    id: 'cart',
    initial: 'empty',
    context: {
      items: [],
    },
    states: {
      empty: {
        on: {
          ADD_ITEM: {
            target: 'hold',
            actions: ['addItem'],
          },
        },
      },
      hold: {
        always: {
          target: 'empty',
          cond: 'isEmpty',
        },
        on: {
          ADD_ITEM: {
            actions: ['addItem'],
          },
          RESET_ITEMS: {
            target: 'empty',
            actions: ['resetItems'],
          },
          REMOVE_ITEM: {
            actions: ['removeItem'],
          },
          PURCHASE: {
            target: 'purchasing',
          },
        },
      },
      purchasing: {
        invoke: {
          id: 'purchasing',
          src: (context) => postPurchase(context.items),
          onDone: {
            target: 'done',
            actions: ['purchased'],
          },
        },
      },
      done: {
        type: 'final',
        entry: ['resetItems'],
      },
    },
  },
  {
    actions: {
      addItem: assign({
        items: ({ items }, event) => [...items, event.item],
      }),
      resetItems: assign({
        items: [],
      }),
      removeItem: assign({
        items: ({ items }, event) => items.filter((item) => item !== event.name),
      }),
    },
    guards: {
      isEmpty: ({ items }) => items.length === 0,
    },
  }
);

const Cart = () => {
  const [state, send, service] = useMachine(stateMachine);

  useEffect(() => {
    const listener = () => console.log('done');

    service.onDone(listener);

    return () => service.off(listener);
  }, []);
  return (
    <div>
      <p>{state.value}</p>
      <ul>
        {state.context.items.map((name, index) => (
          <li key={index}>
            {name}
            <button onClick={() => send('REMOVE_ITEM', { name })}>X</button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => {
          send('ADD_ITEM', { item: `item${Date.now()}` });
        }}
      >
        Add Item
      </button>
      <button
        onClick={() => {
          send('RESET_ITEMS');
        }}
      >
        Reset Item
      </button>
      <button
        onClick={() => {
          send('PURCHASE');
        }}
      >
        Purchase Items
      </button>
    </div>
  );
};

export default Cart;
