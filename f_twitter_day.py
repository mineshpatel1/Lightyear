#!/usr/bin/python
# Twitter - Extract fact - Daily

import lyf, logging
import os

from lyf import psql
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try: 
		twitter_rec = {}
	
		api = lyf.twitter_api()
		me = api.me() # Details about me
	
		twitter_rec['date_id'] = date.today().strftime('%Y%m%d')
		twitter_rec['total_followers'] = me.followers_count
		twitter_rec['total_following'] = me.friends_count
		twitter_rec['total_tweets'] = me.statuses_count
	
		yesterday = date.today() - timedelta(days=1)
		yesterday = yesterday.strftime('%Y%m%d')

		# Check for yesterday's records to derive today's followers
		db = sql.connect()
		db.query("select * from f_twitter_day where date_id = '%s'" % yesterday)
		result = db.store_result()
		result = result.fetch_row(how=1)
		
		if (len(result) > 0):
			twitter_rec['followers'] = int(twitter_rec['total_followers']) - int(result[0]['total_followers'])
			twitter_rec['following'] = int(twitter_rec['total_following']) - int(result[0]['total_following'])
			twitter_rec['tweets'] = int(twitter_rec['total_tweets']) - int(result[0]['total_tweets'])
		else:
			twitter_rec['followers'] = 0
			twitter_rec['following'] = 0
			twitter_rec['tweets'] = 0
		
		
		# mysql.merge_into_table(db, 'f_twitter_day', twitter_rec, ['date_id'])
		db.close()
		
		logging.info('Successfully merged 1 row into f_twitter day (Daily).')
	except Exception as err:
		logging.error(err)
		
if __name__ == '__main__':
	main()
