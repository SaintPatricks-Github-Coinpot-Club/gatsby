import { run } from "../index"
import { initStarter } from "../init-starter"
import { reporter } from "../reporter"

jest.mock(`../init-starter`)
jest.mock(`../reporter`)

describe(`run`, () => {
  describe(`questions`, () => {
    it(`should prompt if yes flag is not passed`, () => {
      process.argv = [``, ``, `hello-world`]
      run()
      expect(reporter.info).toHaveBeenCalledWith(
        expect.stringContaining(`Let's answer some questions:`)
      )
    })
    it(`should skip if yes flag is passed with dir`, () => {
      process.argv = [``, ``, `hello-world`, `-y`]
      run()
      expect(initStarter).toHaveBeenCalled()
    })
  })
})
