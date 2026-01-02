import NamespacedVectorMemory from '../../src/services/namespaced-memory.js';
import { ProjectID } from '../../src/utils/project-id.js';
import path from 'path';

(async () => {
    const cwd = path.resolve('.');
    console.log('Seeding memory for:', cwd);

    const pid = await ProjectID.getOrCreateUID(cwd);
    const memory = new NamespacedVectorMemory();
    await memory.initialize(cwd);

    // Simulate prior learning with EXACT error match
    await memory.store(
        'kubectl get pods --server=https://localhost:12345',
        'The connection to the server localhost:12345 was refused - did you specify the right host or port?',
        'minikube start --driver=docker',
        { cwd }
    );
    console.log('✅ Memory Seeded.');
})();
