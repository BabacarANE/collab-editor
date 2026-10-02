// Les services dépendent de types structurels : un objet partiel suffit
export function fake<T>(impl: Partial<T>): T {
  return impl as T
}
