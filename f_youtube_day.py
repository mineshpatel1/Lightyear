#!/usr/bin/python
# YouTube - Extract fact - Daily

import lyf, logging
import requests

from lyf import *
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try:
		videos = lyf.my_yt_videos()
		db = sql.connect()
		for video in videos:
			rec = {}
			rec['date_id'] = date.today().strftime('%Y%m%d')
			rec['video_id'] = video.id
			rec['title'] = video.name
			rec['publish_date'] = video.publish_date.strftime('%Y-%m-%d %H:%M:%S')
			rec['channel'] = video.channel
			rec['total_views'] = video.views
			rec['total_likes'] = video.likes
			rec['total_dislikes'] = video.dislikes

			yesterday = date.today() - timedelta(days=1)
			yesterday = yesterday.strftime('%Y%m%d')

			# Check for yesterday's records to derive today's followers
			db.query("select * from f_youtube_day where date_id = '%s' and video_id = '%s'" % (yesterday, video.id))
			result = db.store_result()
			result = result.fetch_row(how=1)
		
			if (len(result) > 0):
				rec['views'] = int(video.views) - int(result[0]['total_views'])
				rec['likes'] = int(video.likes) - int(result[0]['total_likes'])
				rec['dislikes'] = int(video.likes) - int(result[0]['total_likes'])
			else:
				rec['views'] = 0
				rec['likes'] = 0
				rec['dislikes'] = 0
	
			sql.merge_into_table(db, 'f_youtube_day', rec, ['date_id', 'video_id'])

		db.close()
		logging.info('Successfully extracted YouTube data.')
		
	except Exception as err:
		logging.error(err)
		
if __name__ == '__main__':
	main()

