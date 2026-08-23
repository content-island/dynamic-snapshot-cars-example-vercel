import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Cars' }],
  }),
  component: home
})

function home() {
  return (
    <Link to='/cars' className='display-title underline-fill font-bold m-24 inline-block'>
      Link to list of cars
    </Link>
  )
}
