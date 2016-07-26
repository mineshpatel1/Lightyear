#!/usr/bin/python

import lyf, logging
import requests
import collections
import argparse

from lyf import psql
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try:
		fb_rec = {}
		today = date.today().strftime('%Y-%m-%d')
		fb_rec['date_id'] = date.today().strftime('%Y%m%d')

		query = 'name,likes,videos{id,likes,description,created_time}'
		query += ',posts{created_time,id,admin_creator,message}'
		results = lyf.fb_query(query)

		fb_rec['total_likes'] = results['likes']
		fb_rec['total_posts'] = len(results['posts']['data'])
		fb_rec['total_videos'] = len(results['videos']['data'])

		totalVidLikes = 0
		for vid in results['videos']['data']:
			totalVidLikes += len(vid['likes']['data'])
		fb_rec['total_video_likes'] = totalVidLikes

		query = 'name,posts.since(%s){created_time,id,admin_creator,message},videos.since(%s){id,likes,description,created_time}' % (today, today)
		results = lyf.fb_query(query)

		if 'posts' in results:
			posts = len(results['posts']['data'])
		else:
			posts = 0
		fb_rec['new_posts'] = posts

		if 'videos' in results:
			videos = len(results['videos']['data'])
		else:
			videos = 0
		fb_rec['new_videos'] = videos

		metrics = [ 'page_impressions', 'page_impressions_unique', 'page_engaged_users', 'page_actions_post_reactions_like_total', 'page_fan_adds_unique', 'page_fan_removes_unique', 'page_views_total', 'page_video_views' ]
		results = lyf.fb_insights_query(metrics, 'day', since=today)

		for datum in results['data']:
			col = datum['name']
			val = datum['values'][0]['value']
			if col == 'page_impressions':
				fb_rec['impressions'] = val
			elif col == 'page_impressions_unique':
				fb_rec['reach'] = val
			elif col == 'page_engaged_users':
				fb_rec['engaged_users'] = val
			elif col == 'page_actions_post_reactions_like_total':
				fb_rec['post_likes'] = val
			elif col == 'page_fan_adds_unique':
				fb_rec['new_likes'] = val
			elif col == 'page_fan_removes_unique':
				fb_rec['new_unlikes'] = val
			elif col == 'page_views_total':
				fb_rec['page_views'] = val
			elif col == 'page_video_views':
				fb_rec['video_views'] = val

			print '%s: %s' % (datum['title'], val)

		db = psql.DB()
		insert = db.upsert('f_facebook_daily', fb_rec, ['date_id'])
		db.close()

		logging.info('Merged %s row into f_facebook_daily.' % insert)
	except Exception as err:
		logging.error(err)

if __name__ == '__main__':
	main()
