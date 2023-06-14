import {expect} from '@loopback/testlab';
import {RedditDataSource} from '../../../datasources';
import {Reddit, RedditProvider} from '../../../services';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('RedditService', function () {
  this.timeout(10000);
  let service: Reddit;
  before(givenRedditService);

  it('gets post from reddit social media', async () => {
    const response = await service.getActions('nw2hs6.json');
    expect(response).to.be.an.instanceOf(Array);
  });

  it('gets user from reddit social media', async () => {
    const response = await service.getActions('u/NetworkMyriad.json');
    expect(response).to.be.an.instanceOf(Object);
  });

  it('gets not found error if post not found in reddit', async () => {
    try {
      await service.getActions('sd1dasd12d.json');
    } catch (err) {
      expect(err.statusCode).to.be.equal(404);
    }
  });

  it('gets not found error if user not found in reddit', async () => {
    try {
      await service.getActions('user/99999qwerty.json');
    } catch (err) {
      expect(err.statusCode).to.be.equal(404);
    }
  });

  async function givenRedditService() {
    const dataSource = new RedditDataSource();
    service = await new RedditProvider(dataSource).value();
  }
});
