import { createMachine } from 'xstate';
import { useMachine } from '@xstate/react';

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
        on: {
          ADD_ITEM: {
            actions: ['addItem'],
          },
        },
      },
    },
  },
  {
    actions: {
      addItem: (context, event) => {
        context.items.push(event.item);
        console.log(context.items);
      },
    },
  }
);

const Cart = () => {
  const [state, send] = useMachine(stateMachine);

  return (
    <div>
      <p>{state.value}</p>
      <ul>
        {state.context.items.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
      <button
        onClick={() => {
          send('ADD_ITEM', { item: `item${Date.now()}` });
        }}
      >
        Add Item
      </button>
    </div>
  );
};

export default Cart;
