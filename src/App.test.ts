import { createMachine, send, interpret, StateValue, assign, sendParent } from 'xstate';
import { choose, escalate, log, raise, respond, pure } from 'xstate/lib/actions';
import { waitFor } from 'xstate/lib/waitFor';

// 애초에 예제자체를 테스트를 염두해두고 만들자. 목차로 describe를 구성해도 좋을듯

describe('XState Study', () => {
  describe('States', () => {
    // 스테이트는 시스템에서의 특정시점의 추상적인 표현이다.
    // 그냥 스테이트 머신이 가질수 있는 상태다.
    //

    it('apis', () => {
      const machine = createMachine({
        id: 'statesapi',
        initial: 'green',
        context: {
          title: 'rgy',
        },
        states: {
          green: {
            meta: {
              // 메타데이터
              msg: 'green!',
            },

            on: {
              TURN_YELLOW: {
                target: 'yellow',
                actions: [() => console.log('turn yellow')],
              },
              TURN_BLUE: 'blue',
            },
          },
          yellow: {
            tags: ['test1', 'test2'], // 스테이트에 태그를 추가할 수 있다.
            meta: {
              msg: 'yellow!',
            },
            on: {
              TURN_GREEN: 'green',
              TURN_BLUE: 'blue',
            },
          },
          blue: {
            meta: {
              msg: 'blue!',
            },

            on: {
              TURN_GREEN: 'green',
              TURN_YELLOW: 'yellow',
            },
          },
        },
      });

      const state = machine.transition('green', 'TURN_YELLOW');

      expect(state.value).toBe('yellow');
      expect(state.matches('yellow')).toEqual(true);
      expect(state.context.title).toEqual('rgy');
      expect(state.event).toEqual({ type: 'TURN_YELLOW' }); // 발생한 이벤트
      expect(state.actions.length).toEqual(1); // 실행될 액션
      expect(state.history?.value).toEqual('green'); // 이전 State 인스턴스
      expect(state.meta['statesapi.yellow'].msg).toEqual('yellow!'); // 스태틱 메타정보
      expect(state.done).toEqual(false); // 현재 스테이트가 파이날 스테이트인지 아닌지

      expect(state.matches('yellow')).toEqual(true); // 현재 스테이트 값 비교
      expect(state.nextEvents).toEqual(['TURN_GREEN', 'TURN_BLUE']); // 현재 전이로 발생한 이벤트 목록
      expect(state.changed).toEqual(true); // 이전 스테이트와 다른지 여부
      expect(state.hasTag('test1')).toEqual(true); // 태그 존재 여부
      expect(state.can('TURN_GREEN')).toEqual(true); // 발생가능한 이벤트 존재 여부
    });
  });

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

  describe('Events', () => {
    it('DOM 네이티브 이벤트를 그대로 이벤트로 활용할 수 있다', () => {
      const mouseMachine = createMachine({
        on: {
          mousemove: {
            actions: [
              (context, event) => {
                const { offsetX, offsetY } = event;
                console.log({ offsetX, offsetY });
              },
            ],
          },
        },
      });
      const mouseService = interpret(mouseMachine).start();

      window.addEventListener('mousemove', (event) => {
        mouseService.send(event);
      });
    });

    it.skip('null events, always - 1', () => {
      // 널이벤트는 스테이트에 진입되면 즉시 실행된다.
      // https://xstate.js.org/docs/guides/events.html#null-events
      // cond 프로퍼티를 사용해서 조건에 따른 분기를 할 수 있는데 always가 동작하지 않는다.
      //'': [
      //    { target: 'adult', cond: isAdult },
      //     { target: 'child', cond: isMinor }
      //   ]
      // //

      const skipMachine = createMachine({
        id: 'skip',
        initial: 'one',
        states: {
          one: {
            on: { CLICK: 'two' },
          },
          two: {
            on: { always: 'three' },
          },
          three: {
            type: 'final',
          },
        },
      });

      const { initialState } = skipMachine;
      const nextState = skipMachine.transition(initialState, 'CLICK');

      console.log(nextState.value);

      expect(nextState.value).toEqual('three');
    });
  });

  describe('transition', () => {
    it('trainsition() method', () => {
      const lightMachine = createMachine({
        /* ... */
      });

      const greenState = lightMachine.initialState;

      // 첫번째 인자는 현재의 State 인스턴스다
      // 두번째 인자는 전이를 발생시킬 이벤트 객체다.
      // 리턴값은 새로운 State 인스턴스다.
      const yellowState = lightMachine.transition(greenState, { type: 'TIMER' });

      // 전이 되는 조건은
      // - 현재 스테이트가 해당 이벤트가 정의되어있어야하고
      // - transition guard가 충족하고
      // - 중첩된 노드의 경우 부모의 이벤트보다 현재 노드의 이벤트가 우선된다.(이말은 이벤트가 버블링된다는 의미)
      //
      // transition에 전달하는 이벤트 객체의 type과 매치되는 값을 이벤트 디스크립터라고한다.
      // 그래서 DOM이벤트 객체를 그대로 사용할 수 있다. m.transition(.., domEvent)
    });

    it('internal transition', () => {
      const fn = jest.fn();

      const wordMachine = createMachine({
        id: 'word',
        initial: 'left',
        states: {
          left: {},
          right: {},
          center: {},
          justify: {}
        },
        on: {
          // internal transitions
          LEFT_CLICK: '.left',
          RIGHT_CLICK: { target: '.right', actions: fn }, // same as '.right'
          CENTER_CLICK: { target: '.center', internal: true }, // same as '.center'
          JUSTIFY_CLICK: { target: '.justify', internal: true } // same as '.justify'
        }
      });

      // 인터널 트렌지션은 상태 노드를 벗어나지 않는다. 그래서 entry, exit의 액션이 실행되지 않는다.(부모것 포함)
      // ".left" 같이 "." 을 붙이거나 {internal: true} 을 사용하면 인터널 트렌지션이 된다.
      // target이 undefined인 경우에도 인터널 트랜지션이 된다.

      const m = interpret(wordMachine).start();

      m.send('RIGHT_CLICK');

      expect(m.state.value).toEqual('right');
      expect(fn).toHaveBeenCalled(); // 전이될때의 이벤트는 실행됨
    });

    it('external transition', () => {
      // https://xstate.js.org/docs/guides/transitions.html#external-transitions
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

    it('forwardTo()는 대상 서비스에 바로 동일한 이벤트를 전달하는 액션을 만든다.', () => { });
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

    it('log()는 선언적으로 현재 context와 상태, 이벤트와 관련된 로깅을 하는 액션을 만든다.', () => { });
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

      expect(stateA.actions.map((i) => i.type)).toEqual([
        'exitCounting',
        'decrement',
        'enterCounting',
      ]);

      // Internal transition (transition actions)
      const stateB = counterMachine.transition('counting', { type: 'DO_NOTHING' });
      expect(stateB.actions.map((i) => i.type)).toEqual(['logNothing']);

      // internal
      const stateC = counterMachine.transition('counting', { type: 'INC' });
      expect(stateC.actions.map((i) => i.type)).toEqual(['increment']);
    });
  });
  describe('guarded transitions', () => {
    // 조건에 따라 특정 상태로 전이할 수 있다
    it('조건에 따라 특정 상태로 전이할 수 있다', () => {
      const searchValid = (context, event) => {
        return context.canSearch && event.query && event.query.length > 0;
      };

      const searchMachine = createMachine(
        {
          id: 'search',
          initial: 'idle',
          context: {
            canSearch: true
          },
          states: {
            idle: {
              on: {
                SEARCH: [
                  {
                    target: 'searching',
                    cond: 'searchValid' // or { type: 'searchValid' }
                  },
                  { target: '.invalid' }
                ]
              },
              initial: 'normal',
              states: {
                normal: {},
                invalid: {}
              }
            },
            searching: {
              entry: 'executeSearch'
              // ...
            },
            searchError: {
              // ...
            }
          }
        },
        {
          guards: {
            searchValid // optional, if the implementation doesn't change
          }
        });

      const state = searchMachine.transition('idle', { type: 'SEARCH', query: 'foo' });

      expect(state.value).toEqual('searching');
    });
    it('Custom gaurds', () => {
      // 가드 함수에 cond 객체를 파라메터 처럼 전달할 수 있다.
      // 가드 함수를 재사용할 수 있다.
      const searchMachine = createMachine(
        {
          // ...
          states: {
            idle: {
              on: {
                SEARCH: {
                  target: 'searching',
                  // Custom guard object
                  cond: {
                    type: 'searchValid',
                    minQueryLength: 3
                  }
                }
              }
            }
            // ...
          }
        },
        {
          guards: {
            searchValid: (context, event, { cond }) => {
              // cond === { type: 'searchValid', minQueryLength: 3 }
              return (
                context.canSearch &&
                event.query &&
                event.query.length > cond.minQueryLength
              );
            }
          }
        }
      );
    });
    it('multiple guards', () => {
      const doorMachine = createMachine(
        {
          id: 'door',
          initial: 'closed',
          context: {
            level: 'user',
            alert: false // alert when intrusions happen
          },
          states: {
            closed: {
              initial: 'idle',
              states: {
                idle: {},
                error: {}
              },
              on: {
                SET_ADMIN: {
                  actions: assign({ level: 'admin' })
                },
                SET_ALARM: {
                  actions: assign({ alert: true })
                },
                OPEN: [
                  // 위에 있을 수록 컨디션 조건이 더 우선적으로 처리된다.
                  { target: 'opened', cond: 'isAdmin' },
                  { target: '.error', cond: 'shouldAlert' }, // 차일드 스테이트가 자신의 스테이트 선택
                  { target: '.idle' } // 디폴트 조건
                ]
              }
            },
            opened: {
              on: {
                CLOSE: { target: 'closed' }
              }
            }
          }
        },
        {
          guards: {
            isAdmin: (context) => context.level === 'admin',
            shouldAlert: (context) => context.alert === true
          }
        }
      );

      const doorService = interpret(doorMachine).start();

      doorService.send('OPEN');

      expect(doorService.state.value).toEqual({ 'closed': 'idle' });


      doorService.send('SET_ALARM');
      doorService.send('OPEN');

      expect(doorService.state.value).toEqual({ 'closed': 'error' });

      doorService.send('SET_ADMIN');
      doorService.send('OPEN');

      expect(doorService.state.value).toEqual('opened');
    });

    it('in state guard', () => {
      // 현재 상태에 따라 판단할 수 있는 가드

      const lightMachine = createMachine({
        id: 'light',
        initial: 'red',
        states: {
          green: {
            on: {
              TIMER: { target: 'yellow' }
            }
          },
          yellow: {
            on: {
              TIMER: { target: 'red' }
            }
          },
          red: {
            initial: 'walk',
            states: {
              walk: {
                /* ... */
              },
              wait: {
                /* ... */
              },
              stop: {
                /* ... */
              }
            },
            on: {
              TIMER: [
                {
                  target: 'green',
                  in: '#light.red.stop' // 현재 stop 상태라면 전이 실행
                }
              ],
              STOP: { target: '.stop' }
            }
          }
        }
      });

      const lightService = interpret(lightMachine).start();

      lightService.send('TIMER');

      expect(lightService.state.value).not.toEqual('green');

      lightService.send('STOP');
      lightService.send('TIMER');
      expect(lightService.state.value).toEqual('green');
    });
  });

  describe('Context', () => { });

  describe('invoking service', () => {
    // 하나의 머신에서 어플리케이션 전체를 커버하는 것은 너무 복잡해질 수 있다.
    // 여러개의 머신으로 분할하고 서로 통신하게 만드는 것이 좋다.
    // 일종의 Actor model이다. 각 모델 인스턴스는 액터라고 보면된다.
    // 사이드 이펙트를 실행하는 방법이다.
    // 이벤트를 전달하거나 받을 수 있다.
    // 부모 머신이 자식 머신을 인보크하는 형태로 만들어진다.
    // 머신 뿐만 아니라 Promise, Callback, Observable도 인보크할 수 있다. 즉 머신으로 사용할 수 있다.
    // 빠른 참조: https://xstate.js.org/docs/guides/communication.html#quick-reference

    it('invoking promise', async () => {
      type Context = { userId: number; user?: string; error?: string };

      // 프로미스에서 reject 되거나 Error가 throw되면 onError 이벤트 발생한다.
      const fetchUser = ({ userId }: Context) =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve('shiren');
          }, 0);
        });

      const userMachine = createMachine<Context>({
        id: 'user',
        initial: 'idle',
        context: {
          userId: 42,
          user: undefined,
          error: undefined,
        },
        states: {
          idle: {
            on: {
              FETCH: { target: 'loading' },
            },
          },
          loading: {
            // 배열로 여러개 선언하는 것도 가능하다.
            invoke: {
              id: 'getUser',
              src: (context, event) => fetchUser(context),
              onDone: {
                target: 'success',
                actions: [assign({ user: (context, event) => event.data })],
              },
              onError: {
                target: 'failure',
                actions: [assign({ error: (context, event) => event.data })],
              },
            },
          },
          success: { type: 'final' },
          failure: {
            on: {
              RETRY: { target: 'loading' },
            },
          },
        },
      });

      userMachine.transition('idle', { type: 'FETCH' });

      const service = interpret(userMachine).start();

      service.send('FETCH');

      await waitFor(service, (state) => state.matches('success'));
      expect(service.state.context.user).toEqual('shiren');
    });
    it('invoking callback', (done) => {
      // callback 핸들러로 서비스를 등록할 수 있다.

      const service = createMachine({
        id: 'pinger',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'ponger',
              // 콜백 형태의 자식 머신
              // callback은 메시지를 전달할 때 사용
              // onReceive는 메시지를 받을때 사용
              // 함수를 리턴하면 리액트의 이팩트처럼 리소스를 제거하거나 정리하는 함수로 실행된다.
              src: (context, event) => (callback, onReceive) => {
                onReceive((e) => {
                  if (e.type === 'PING') {
                    callback('PONG');
                  }
                });
              },
            },
            entry: send({ type: 'PING' }, { to: 'ponger' }),
            on: {
              PONG: { target: 'done' },
            },
          },
          done: {
            type: 'final',
          },
        },
      });

      const events: string[] = [];

      interpret(service)
        .onEvent((e) => {
          events.push(e.type);
        })
        .onDone(() => {
          // ping 은 액터에게 보내는 것이니까 쌓이지 않는다.
          expect(events).toEqual(['xstate.init', 'PONG']);
          done();
        })
        .start();
    });
    it('invoking Observable', () => {
      // Observable으로 액터로 사용할 수 있다.
      // 대부분의 구현체를 사용할 수 있는 듯 함. 대표적으로 rxjs. 일단 생략 한다.
    });
    it('invoking machine', async () => {
      // 당연히 일반 머신도 액터로 사용할 수 있다.
      const minuteMachine = createMachine({
        id: 'timer',
        initial: 'active',
        states: {
          active: {
            after: {
              1: { target: 'finished' },
            },
          },
          finished: { type: 'final' },
        },
      });

      const parentMachine = createMachine({
        id: 'parent',
        initial: 'pending',
        states: {
          pending: {
            invoke: {
              src: minuteMachine,
              onDone: 'timesUp',
            },
          },
          timesUp: {},
        },
      });

      const service = interpret(parentMachine).start();

      await waitFor(service, (state) => state.matches('timesUp'));

      expect(service.state.value).toEqual('timesUp');
    });

    it('Invoke machine with context', (done) => {
      // 자식 머신은 data 프로퍼티로 context의 내용을 전달 받을 수 있다. 일종의 인자, 파라메터같은것이다.
      // 자식 머신은 final 노드에서 data 프롭으로 부모에게 데이터를 전달할 수 있다.
      // 자식 머신에게 인풋을 주고 아웃풋을 받는 방법.

      const minuteMachine = createMachine<{ duration: number; text: string }>({
        id: 'timer',
        initial: 'active',
        context: {
          duration: 1000,
          text: 'my value',
        },
        states: {
          active: {
            entry: (context) => {
              // 부모에게서 컨텍스트를 전달받았다.
              expect(context.duration).toEqual(2000);
              expect(context.text).toEqual('parent value');
              done();
            },
            after: {
              1000: { target: 'finished' },
            },
          },
          finished: { type: 'final', data: { childData: () => 'finish' } },
        },
      });

      const parentMachine = createMachine<{ name: string; childData?: string }>({
        id: 'parent',
        initial: 'pending',
        context: {
          name: 'parent value',
        },
        states: {
          pending: {
            invoke: {
              id: 'timer',
              src: minuteMachine,
              // 자식의 컨텍스트로 전달
              data: {
                duration: 2000,
                text: 'parent value',
              },
              onDone: {
                target: 'timesUp',
                actions: [
                  // 자식에게서 데이터를 전달 받음
                  assign({ childData: (_, event) => event.data.childData }),
                  (context) => {
                    expect(context.childData).toEqual('finish');
                    done();
                  },
                ],
              },
            },
          },
          timesUp: {
            type: 'final',
          },
        },
      });

      interpret(parentMachine).start();
    });
    it('invoke machine, sending events', (done) => {
      // 수시로 부모와 자식이 이벤트를 주고 받을 수 있다.
      const pongMachine = createMachine({
        id: 'pong',
        initial: 'active',
        states: {
          active: {
            on: {
              PING: {
                // 부모에게 이벤트 전달은 sendParent로
                // respond를 써도 된다.
                actions: sendParent('PONG', {
                  delay: 1,
                }),
              },
            },
          },
        },
      });

      // Parent machine
      const pingMachine = createMachine({
        id: 'ping',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'pong',
              src: pongMachine,
            },
            // 자식 머신 pong에게 이벤트 전달은 send로
            entry: send({ type: 'PING' }, { to: 'pong' }),
            on: {
              PONG: {
                actions: [
                  () => {
                    done();
                  },
                ],
              },
            },
          },
        },
      });

      interpret(pingMachine).start();
    });
    it.skip('서비스를 미리 등록해두고 사용할 수 있다.', () => {
      const fetchUser = (id: string) => Promise.resolve({ id, name: 'John' });
      const userMachine = createMachine(
        {
          id: 'user',
          // ...
          states: {
            // ...
            loading: {
              invoke: {
                src: 'getUser',
                // ...
              },
            },
            // ...
          },
        },
        {
          services: {
            getUser: () => fetchUser('dd'),
          },
        }
      );
    });
    it.skip('서비스를 미리 등록해두고 사용할 수 있다2, 메타데이터(파라메터?) 전달', () => {
      const fetchUser = (id: string) => Promise.resolve({ id, name: 'John' });
      const userMachine = createMachine(
        {
          id: 'user',
          // ...
          states: {
            // ...
            loading: {
              invoke: {
                src: {
                  type: 'getUser',
                  endpoint: 'example.com',
                },
              },
            },
            // ...
          },
        },
        {
          services: {
            getUser: (c, e, { src }) => fetchUser(`${src.endpoint}dd`),
          },
        }
      );
    });
    it.skip('.withCOnfig() 으로 특정 서비스를 모킹할 수 있다.', () => {
      const mockFetchUser = async (userId: any) => {
        return { name: 'Test', location: 'Anywhere' };
      };

      // @ts-ignore
      const testUserMachine = userMachine.withConfig({
        services: {
          getUser: () => mockFetchUser('dd'),
        },
      });

      interpret(testUserMachine)
        .onTransition((state) => {
          if (state.matches('success')) {
            // eslint-disable-next-line
            expect(state?.context?.user).toEqual({
              name: 'Test',
              location: 'Anywhere',
            });
          }
        })
        .start();
    });
    it.skip('서비스에 대한 참조', () => {
      /* eslint-disable */
      const service = interpret(machine)
        .onTransition((state) => {
          state.children.notifier; // notifier 는 id
          state.children.logger; // service from createLogger()
        })
        .start();
      /* eslint-enable */
    });
  });
});
