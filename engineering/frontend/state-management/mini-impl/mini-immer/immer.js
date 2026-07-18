function produce(baseState, recipe){
  // 存储每个对象的代理副本状态
  const stateMap = new Map();

  // 创建代理的辅助函数
  function createProxy(base){
    if (typeof base !== 'object' || base === null) return base;

    // 如果已经代理过了，直接返回
    if (stateMap.has(base)) return stateMap.get(base).proxy;

    // 每一个被代理的对象，都有一个内部状态（State）
    const internalState = {
      base,          // 原始数据
      copy: null,    // 只有在发生修改时，才会创建的浅拷贝
      modified: false, // 标记该节点（或子节点）是否被修改过
      proxies: {}    // 缓存子属性的代理对象
    };

    const handler = {
      // 1. 拦截读取操作
      get(target, prop) {
        // 如果已经修改过了，从拷贝里读；否则从原对象里读
        const source = internalState.copy ? internalState.copy : internalState.base;
        const value = source[prop];

        if (typeof value === 'object' && value !== null) {
          // 【惰性代理】：只有当开发者真正访问到子对象时，才为其创建 Proxy
          if (!internalState.proxies[prop]) {
            internalState.proxies[prop] = createProxy(value);
          }
          return internalState.proxies[prop];
        }
        return value;
      },

      // 2. 拦截修改操作（写时复制的核心）
      set(target, prop, newValue) {
        if (!internalState.modified) {
          internalState.modified = true;
          // 【核心】：触发写时复制，只进行一层浅拷贝！
          internalState.copy = Array.isArray(internalState.base)
            ? [...internalState.base]
            : { ...internalState.base };
        }

        // 将新值赋给浅拷贝对象
        internalState.copy[prop] = newValue;
        return true;
      }
    };

    const proxy = new Proxy(base, handler);
    internalState.proxy = proxy;
    stateMap.push ? null : stateMap.set(base, internalState); // 记录映射

    return proxy;
  }

  // 1. 基于 baseState 创建一个根部的 Draft (Proxy)
  const rootDraft = createProxy(baseState);

  // 2. 执行用户的修改函数（用户在里面随便改 draft）
  recipe(rootDraft);

  // 3. 【收尾工作】：递归检查哪些节点改了，组装出最终的新状态树
  function finalize(base){
    if (typeof base !== 'object' || base === null) return base;

    const internal = stateMap.get(base);
    if (!internal) return base;

    // 如果这个节点被修改了
    if (internal.modified) {
      // 还需要递归检查它的子属性，把子属性里的代理替换为最终的真实数据
      Object.keys(internal.proxies).forEach(key => {
        const subInternal = stateMap.get(internal.base[key]);
        if (subInternal) {
          internal.copy[key] = finalize(internal.base[key]);
        }
      });
      return internal.copy; // 返回新创建的浅拷贝
    }

    // 如果这个节点及子节点完全没被动过，直接返回原对象，实现完美的【结构共享】
    return internal.base;
  }

  return finalize(baseState);
}