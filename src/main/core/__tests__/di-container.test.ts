import { DIContainer } from '../di-container';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('register and get', () => {
    it('should register and retrieve a value', async () => {
      const testValue = { name: 'test', value: 42 };
      container.register('testService', () => testValue);

      const retrieved = await container.get('testService');
      expect(retrieved).toBe(testValue);
    });

    it('should register and retrieve a promise', async () => {
      const testValue = { name: 'async', value: 100 };
      container.register('asyncService', () => Promise.resolve(testValue));

      const retrieved = await container.get('asyncService');
      expect(retrieved).toBe(testValue);
    });

    it('should throw error for unregistered service', async () => {
      await expect(container.get('nonExistent')).rejects.toThrow(
        "Service 'nonExistent' not found"
      );
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance for singleton', async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: Math.random() };
      };

      container.register('singletonService', factory, { singleton: true });

      const instance1 = await container.get('singletonService');
      const instance2 = await container.get('singletonService');
      const instance3 = await container.get('singletonService');

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(callCount).toBe(1);
    });

    it('should return different instances for non-singleton', async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: Math.random() };
      };

      container.register('transientService', factory, { singleton: false });

      const instance1 = await container.get('transientService');
      const instance2 = await container.get('transientService');
      const instance3 = await container.get('transientService');

      expect(instance1).not.toBe(instance2);
      expect(instance2).not.toBe(instance3);
      expect(callCount).toBe(3);
    });
  });

  describe('dependency injection', () => {
    it('should resolve dependencies', async () => {
      // Database service
      container.register('database', () => ({
        query: jest.fn(),
        execute: jest.fn()
      }), { singleton: true });

      // Repository depends on database
      container.register('repository', async () => {
        const db = await container.get('database');
        return {
          db,
          find: jest.fn(),
          save: jest.fn()
        };
      }, { singleton: true });

      // Service depends on repository
      container.register('service', async () => {
        const repo = await container.get('repository');
        return {
          repo,
          process: jest.fn()
        };
      }, { singleton: true });

      const service = await container.get('service');
      const repository = await container.get('repository');
      const database = await container.get('database');

      expect((service as any).repo).toBe(repository);
      expect((repository as any).db).toBe(database);
    });

    it('should handle circular dependencies gracefully', async () => {
      // Service A depends on Service B
      container.register('serviceA', async () => {
        const serviceB = await container.get('serviceB');
        return { name: 'A', dependency: serviceB };
      });

      // Service B depends on Service A (circular)
      container.register('serviceB', async () => {
        const serviceA = await container.get('serviceA');
        return { name: 'B', dependency: serviceA };
      });

      // This should throw or timeout
      await expect(container.get('serviceA')).rejects.toThrow();
    });
  });

  describe('has method', () => {
    it('should return true for registered services', () => {
      container.register('existingService', () => ({}));
      
      expect(container.has('existingService')).toBe(true);
      expect(container.has('nonExistingService')).toBe(false);
    });
  });

  describe('overwriting services', () => {
    it('should allow overwriting services', async () => {
      container.register('service', () => ({ version: 1 }));
      const v1 = await container.get('service');
      expect((v1 as any).version).toBe(1);

      container.register('service', () => ({ version: 2 }));
      const v2 = await container.get('service');
      expect((v2 as any).version).toBe(2);
    });

    it('should clear singleton cache when overwriting', async () => {
      container.register('singleton', () => ({ version: 1 }), { singleton: true });
      const v1 = await container.get('singleton');
      expect((v1 as any).version).toBe(1);

      container.register('singleton', () => ({ version: 2 }), { singleton: true });
      const v2 = await container.get('singleton');
      expect((v2 as any).version).toBe(2);
      expect(v1).not.toBe(v2);
    });
  });

  describe('error handling', () => {
    it('should propagate factory errors', async () => {
      container.register('errorService', () => {
        throw new Error('Factory error');
      });

      await expect(container.get('errorService')).rejects.toThrow('Factory error');
    });

    it('should propagate async factory errors', async () => {
      container.register('asyncErrorService', async () => {
        throw new Error('Async factory error');
      });

      await expect(container.get('asyncErrorService')).rejects.toThrow(
        'Async factory error'
      );
    });
  });

  describe('type safety', () => {
    it('should work with typed services', async () => {
      interface IUserService {
        getUser(id: string): { id: string; name: string };
      }

      const userService: IUserService = {
        getUser: (id) => ({ id, name: 'Test User' })
      };

      container.register<IUserService>('userService', () => userService);

      const retrieved = await container.get<IUserService>('userService');
      const user = retrieved.getUser('123');

      expect(user.id).toBe('123');
      expect(user.name).toBe('Test User');
    });
  });
});