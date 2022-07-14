import { createMachine, send, interpret, StateValue, ActorRef } from 'xstate';
import { choose, escalate, log, raise, respond, pure } from 'xstate/lib/actions';
import { waitFor } from 'xstate/lib/waitFor';

// 애초에 예제자체를 테스트를 염두해두고 만들자. 목차로 describe를 구성해도 좋을듯

describe('XState Study', () => {
  describe('기본 상태 전환', () => {
    let opt1 = {
      id: 'basic',
      initial: 'close',
      states: {
        close: {
          on: {
            TURNOPEN: {
              target: 'open',
            },
          },
        },
        open: {
          on: {
            TURNCLOSE: {
              target: 'close',
            },
          },
        },
      },
    };

    it('transition', () => {
      const m = createMachine(opt1);
      const expected = 'open';
      const actual = m.transition(m.initialState, { type: 'TURNOPEN' });

      expect(actual.matches(expected)).toBeTruthy();
      expect(actual.value).toEqual(expected);
      expect(actual.context).toBeUndefined();
      expect(actual.event).toEqual({ type: 'TURNOPEN' });
    });
  });

  describe('State node', () => {
    const runNode = {
      type: 'compound' as const,
      initial: 'go',
      states: {
        go: {
          on: {
            NO_ENERGY: { target: 'stop' },
          },
        },
        stop: {
          type: 'final' as const,
        },
      },
    };

    const config = {
      id: 'basicStateNodes',
      initial: 'idle',
      states: {
        idle: {
          on: {
            RUN: { target: 'run' },
          },
        },
        run: Object.assign(
          {
            on: {
              IDLE: { target: 'idle' },
            },
            onDone: 'idle',
          },
          runNode
        ),
      },
    };

    it('자식 노드로 이동', () => {
      let m = createMachine(config);
      let nextState = m.transition(m.initialState, { type: 'RUN' });

      expect(nextState.value).toEqual({ run: 'go' });
      expect(nextState.can('NO_ENERGY')).toBe(true);
    });

    it('child 노드에서 상위 노드로 전이하기', () => {
      let m = createMachine(config);
      let nextState = m.transition(m.initialState, { type: 'RUN' });
      expect(nextState.matches({ run: 'go' })).toEqual(true);
      nextState = m.transition(nextState, { type: 'IDLE' });
      expect(nextState.matches('idle')).toEqual(true);
    });

    it('child 노드에서 final 스테이트로 전이해서 done이벤트로 노드 탈출하기', () => {
      let m = createMachine(config);
      let nextState = m.transition(m.initialState, { type: 'RUN' });
      expect(nextState.matches({ run: 'go' })).toEqual(true);
      nextState = m.transition(nextState, { type: 'NO_ENERGY' });
      expect(nextState.matches('idle')).toEqual(true);
    });

    it('현재 실행(발생)가능한 이벤트 목록', () => {
      let m = createMachine(config);
      let nextState = m.transition(m.initialState, { type: 'RUN' });

      expect(nextState.nextEvents).toEqual(['NO_ENERGY', 'done.state.basicStateNodes.run', 'IDLE']);
    });

    describe('paralell', () => {
      let parallelConfig = {
        id: 'parallel',
        initial: 'idle',
        states: {
          idle: {
            on: {
              MOVE: {
                target: 'move',
              },
            },
          },
          move: {
            type: 'parallel' as const,
            states: {
              run: runNode,
              eat: {
                initial: 'noFood',
                states: {
                  noFood: {
                    on: {
                      FIND_FOOD: {
                        target: 'findFood',
                      },
                    },
                  },
                  chewing: {
                    on: {
                      ATE: {
                        target: 'noFood',
                      },
                    },
                  },
                  findFood: {
                    on: {
                      CHEW: {
                        target: 'chewing',
                      },
                    },
                  },
                },
              },
            },
            on: {
              RESET: {
                target: ['.run.go', '.eat.noFood'],
              },
            },
          },
        },
      };

      it('병렬 상태 확인', () => {
        let m = createMachine(parallelConfig);
        let nextState = m.transition(m.initialState, { type: 'MOVE' });

        expect(nextState.value).toEqual({ move: { run: 'go', eat: 'noFood' } });
        expect(m.transition(nextState, { type: 'FIND_FOOD' }).value).toEqual({
          move: { run: 'go', eat: 'findFood' },
        });
      });

      it('multiple targets', () => {
        let m = createMachine(parallelConfig);
        let nextState = m.transition(m.initialState, { type: 'MOVE' });

        nextState = m.transition(nextState, { type: 'FIND_FOOD' });
        nextState = m.transition(nextState, { type: 'NO_ENERGY' });

        expect(nextState.value).toEqual({ move: { run: 'stop', eat: 'findFood' } });

        nextState = m.transition(nextState, { type: 'RESET' });

        expect(nextState.value).toEqual({ move: { run: 'go', eat: 'noFood' } });
      });
    });
  });

  describe('actions', () => {
    it('send()는 전이한후 다름 스텝(프레임)에서 이벤트를 발생시키는 액션을 만든다', () => {
      const lazyStubbornMachine = createMachine({
        id: 'stubborn',
        initial: 'inactive',
        states: {
          inactive: {
            on: {
              TOGGLE: {
                target: 'active',
                actions: send('TOGGLE'),
              },
            },
          },
          active: {
            on: {
              TOGGLE: { target: 'inactive' },
            },
          },
        },
      });

      const nextState = lazyStubbornMachine.transition('inactive', {
        type: 'TOGGLE',
      });

      // 현재 스텝에서는 바뀌지 않는다.
      expect(nextState.matches('active')).toBe(true);

      // 다음 스텝에서 실행될 액션이 등록되어있다. 실제로는 테스트 종료후 실행되서 전이가 되는 것은 테스트가 보지 못함 waitFor쓰면 가능
      expect(nextState.actions.length).toEqual(1);
    });

    it('raise() 전이한후 현재 스텝(프레임)에 곧바로 이벤트를 실행하는 액션을 만든다', () => {
      // send()와 차이점은 send()는 이벤트의 실행을 현재 머신의 스텝이 모두 종료되고 다음 스텝(프레임)실행되는데 반해 raise() 바로 이벤트를 실행한다.
      // 그래서 send()는 다른 액터의 이벤트를 실행할때 사용되는 듯 현재 머신의 상태가 모두 전이되고 액터의 이벤트를 실행
      const lazyStubbornMachine = createMachine({
        id: 'stubborn',
        initial: 'inactive',
        states: {
          inactive: {
            on: {
              TOGGLE: {
                target: 'active',
                actions: raise('TOGGLE'),
              },
            },
          },
          active: {
            on: {
              TOGGLE: { target: 'inactive' },
            },
          },
        },
      });

      const nextState = lazyStubbornMachine.transition('inactive', {
        type: 'TOGGLE',
      });

      expect(nextState.matches('inactive')).toEqual(true);

      // 현재 스텝에서 액션이 실행되서 다음프레임이 실행될 액션이 없다.
      expect(nextState.actions.length).toEqual(0);
    });

    it('respond()는 send이벤트와 동일하지만 외부에서 실행된 이벤트에 대한 응답 이밴트를 발생하는 액션을 작성한다.', async () => {
      const authServerMachine = createMachine({
        initial: 'waitingForCode',
        states: {
          waitingForCode: {
            on: {
              CODE: {
                actions: respond({ type: 'TOKEN' }, { delay: 10 }),
              },
            },
          },
        },
      });

      const authClientMachine = createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              AUTH: { target: 'authorizing' },
            },
          },
          authorizing: {
            invoke: {
              id: 'auth-server',
              src: authServerMachine,
            },
            entry: send('CODE', { to: 'auth-server' }),
            on: {
              TOKEN: { target: 'authorized' },
            },
          },
          authorized: {
            type: 'final',
          },
        },
      });

      const actual: StateValue[] = [];

      const authClientService = interpret(authClientMachine)
        .start()
        .onTransition((state) => {
          actual.push(state.value);
        });

      authClientService.send('AUTH');

      await waitFor(authClientService, (state) => state.matches('authorized'));

      expect(actual).toEqual(['idle', 'authorizing', 'authorized']);
    });

    it('forwardTo()는 대상 서비스에 바로 동일한 이벤트를 전달하는 액션을 만든다.', () => {});
    it('escalate()는 부모 머신에 에러 이벤트를 발생해주는 액션을 만든다', (done) => {
      const childMachine = createMachine({
        entry: escalate({ message: '!!' }),
      });

      const parentMachine = createMachine({
        invoke: {
          src: childMachine,
          onError: {
            actions: (context, event) => {
              expect(event.data.message).toEqual('!!');
              done();
            },
          },
        },
      });

      interpret(parentMachine).start();
    });

    it('log()는 선언적으로 현재 context와 상태, 이벤트와 관련된 로깅을 하는 액션을 만든다.', () => {});
    it('choose()는 일종의 액션을 실행하기위한 선언적인 조건문이다', () => {
      const maybeDoThese = choose([
        {
          cond: 'cond1',
          actions: [log('cond1 chosen!')],
        },
        {
          cond: 'cond2',
          actions: [
            log((context, event) => {
              /* ... */
            }),
            log('another action'),
          ],
        },
        {
          // 조건을 함수로 만들 수도 있다.
          cond: (context, event) => {
            return false;
          },
          actions: [
            (context, event) => {
              // some other action
            },
          ],
        },
        {
          // 모든 조건이 false면 폴스루
          actions: [log('fall-through action')],
        },
      ]);
    });
    it('pure()는 context와 event를 기반으로 다이나믹하게 액션을 실행할 수 있다.', () => {
      const sendToAllSampleActors = pure((context, event) => {
        // @ts-ignore
        return context.sampleActors.map((sampleActor) => {
          console.log(event);
          return send('SOME_EVENT', { to: sampleActor });
        });
      });
      // => {
      //   type: ActionTypes.Pure,
      //   get: () => ... // send의 배열을 모두 실행한다.
      // }

      const machine = createMachine({
        // ...
        states: {
          active: {
            entry: sendToAllSampleActors,
          },
        },
      });
    });

    it('self-transition을 하는 액션', () => {
      /*
      - internal 과 external 이 있다.
      - internal은
         - exit하거나 다시 들어오는게 아니기에 entry나 exit 액션이 재실행되지 않는다.
         - 조건은 {internal: true} 이거나 (C)
         - target이 undefined인 경우(A)
      - external은
         - exit하고 다시 들어온다 그래서 entry, exit 액션이 실행된다.
         - 모든 전이는 디폴트로 external이다. 기본적으로 {internal: false}
         - 조건은 target이 있고 액션도 있으면된다. (B)

      */
      const counterMachine = createMachine({
        id: 'counter',
        initial: 'counting',
        states: {
          counting: {
            entry: 'enterCounting',
            exit: 'exitCounting',
            on: {
              // self-transitions
              INC: { actions: 'increment' }, // A, internal
              DEC: { target: 'counting', actions: 'decrement' }, // B, external
              DO_NOTHING: { internal: true, actions: 'logNothing' }, // C, internal (explicit)
            },
          },
        },
      });

      // External transition (exit + transition actions + entry)
      const stateA = counterMachine.transition('counting', { type: 'DEC' });

      expect(stateA.actions).toEqual(['exitCounting', 'decrement', 'enterCounting']);

      // Internal transition (transition actions)
      const stateB = counterMachine.transition('counting', { type: 'DO_NOTHING' });
      expect(stateB.actions).toEqual(['logNothing']);

      // internal
      const stateC = counterMachine.transition('counting', { type: 'INC' });
      expect(stateC.actions).toEqual(['increment']);
    });
  });
});
