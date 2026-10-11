import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// The first render in a file can take over a second on slower machines (default wait: 1 s)
configure({ asyncUtilTimeout: 5000 });

afterEach(cleanup);
