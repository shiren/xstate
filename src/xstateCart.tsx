import { createMachine, assign, EventObject } from 'xstate';
import { useMachine } from '@xstate/react';

// https://stately.ai/blog/just-use-hooks-xstate-in-react-components

const postPurchase = (cart: string[]): Promise<boolean> =>
  new Promise((res) => {
    setTimeout(() => {
      res(true);
    }, 2000);
  });

type Context = {
  items: string[];
  maxItems: number;
}

const cartMachine = createMachine<Context>({
  id: 'cart',
  initial: 'empty',
  context: {
    items: [],
    maxItems: 3,
  },
  states: {
    empty: {
      on: {
        ADD_ITEM: {
          target: 'hold',
          actions: ['addItem']
        }
      }
    },
    hold: {
      always: [{
        target: 'full',
        cond: 'isFull'
      }, {
        target: 'empty',
        cond: 'isEmpty'
      }],
      on: {
        ADD_ITEM: {
          actions: ['addItem']
        },
        REMOVE_ITEM: {
          actions: ['removeItem']
        }
      }
    },
    full: {
      on: {
        PURCHASE: {
          target: 'loading',
        },
        REMOVE_ITEM: {
          target: 'hold',
          actions: ['removeItem']
        }
      }
    },
    loading: {
      invoke: {
        id: 'postPurchase',
        src: (context) => postPurchase(context.items),
        onDone: {
          target: 'done',
        }
      }
    },
    done: {
      type: 'final',
      entry: ['complete'],
      exit: ['resetItem']
    }
  }
}, {
  actions: {
    addItem: assign({
      items: ({ items }) => [...items, `newITEM${Date.now()}`]
    }),
    removeItem: assign({
      items: ({ items }, { name }) => items.filter(item => item !== name)
    }),
    resetItem: assign<Context>({ // 버전 4에서 어싸인은 다른 액션 보다 우선순위가 높다. 5부터는 그냥 순서대로 실행됨.
      items: []
    })
  },
  guards: {
    isFull: ({ items, maxItems }) => items.length >= maxItems,
    isEmpty: ({ items }) => items.length === 0
  }
});

const Cart: React.FC<{ items: string[], onRemoveItem: (name: string) => void }> = ({ items, onRemoveItem }) => {
  return <div>
    <ul>
      {items.map((name, index) => (
        <li key={index}>{name} <button onClick={() => { onRemoveItem(name) }}>X</button></li>
      ))}
    </ul>
  </div>
}


const XStateCart = () => {
  const [state, send] = useMachine(cartMachine, {
    actions: {
      complete: (context) => {
        console.log(context.items.length)
      }
    }
  });

  const removeItem = (name: string) => {
    send('REMOVE_ITEM', { name });
  }

  return (
    <div className="Cart" >
      <p>{state.toStrings()}</p>
      <Cart items={state.context.items} onRemoveItem={removeItem} />
      {!state.matches('full') && <button onClick={() => { send('ADD_ITEM') }}>Add</button>}
      {state.matches('full') && <button onClick={() => send('PURCHASE')}>purchase</button>}
    </div>
  );
}

export default XStateCart;
