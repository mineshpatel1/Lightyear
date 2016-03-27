#!/usr/bin/python
# YouTube - Extract fact - Daily

import lyf, logging
import requests

from lyf import psql
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try:
		db = psql.DB()
		videos = lyf.my_yt_videos()
		inserts = 0
		
		for video in videos:
			rec = {}
			rec['date_id'] = date.today().strftime('%Y%m%d')
			rec['video_id'] = video.id
			rec['title'] = video.name
			rec['publish_date'] = video.publish_date
			rec['channel'] = video.channel
			rec['total_views'] = video.views
			rec['total_likes'] = video.likes
			rec['total_dislikes'] = video.dislikes

			# Check for yesterday's records to derive today's followers
			yesterday = date.today() - timedelta(days=1)
			yesterday = int(yesterday.strftime('%Y%m%d'))

			results = db.query("select * from lyf.f_youtube_daily where date_id = %s and video_id = %s", [yesterday, video.id])
			
			if (len(results) > 0):
				rec['views'] = int(video.views) - int(results[0]['total_views'])
				rec['likes'] = int(video.likes) - int(results[0]['total_likes'])
				rec['dislikes'] = int(video.likes) - int(results[0]['total_likes'])
			else:
				rec['views'] = 0
				rec['likes'] = 0
				rec['dislikes'] = 0
				
			inserts += db.upsert('f_youtube_daily', rec, ['date_id', 'video_id'])
		
		db.close()
		logging.info('Merged %s/%s rows into f_youtube_daily.' % (inserts, len(videos)))
	
	except Exception as err:
		logging.error(err)
		
if __name__ == '__main__':
	main()

