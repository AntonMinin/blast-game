export function requireProperty<T>(value: T | null, name: string): T {
    if (value === null) {
        throw new Error(`Property "${name}" is not assigned in the editor`);
    }
    return value;
}
