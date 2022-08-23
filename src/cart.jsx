import { createMachine } from 'xstate';
import { useMachine } from '@xstate/react';

const stateMachine = createMachine({
  id: 'cart',
  initial: 'empty',
  states: {
    empty: {
      on: {
        ADD_ITEM: {
          target: 'hold',
        },
      },
    },
    hold: {},
  },
});

const Cart = () => {
  const [state, send] = useMachine(stateMachine);

  return (
    <div>
      <p>{state.value}</p>
      <button
        onClick={() => {
          send('ADD_ITEM');
        }}
      >
        Add Item
      </button>
    </div>
  );
};

export default Cart;
