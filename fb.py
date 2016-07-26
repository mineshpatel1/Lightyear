#!/usr/bin/python

import lyf
import requests
import collections
import argparse

from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

parser = argparse.ArgumentParser(description="Extract Facebook page data")
parser.add_argument("-f", "--full", action='store_true', default=False, help="Specifies full mode for extract as opposed to incremental.")

args = parser.parse_args()
FULL_MODE = args.full

def main():
	query = 'name,likes,videos{id,likes,description,created_time}'
	if FULL_MODE:
		query += ',posts{created_time,id,admin_creator,message}'
	else:
		# prev_month = date.today() - timedelta(days=30)
		# prev_month = prev_month.strftime('%Y-%m-%d')
		today = date.today().strftime('%Y-%m-%d')
		query += ',posts{created_time,id,admin_creator,message}' # % today
	results = lyf.fb_query(query)

	print('Page Name: %s' % results['name'])
	print('Likes: %s' % results['likes'])
	print('Total Videos: %s' % len(results['videos']['data']))
	print('Total Posts: %s' % len(results['posts']['data']))

	totalVidLikes = 0
	for vid in results['videos']['data']:
		totalVidLikes += len(vid['likes']['data'])
	print('Total Video likes: %s' % totalVidLikes)

	today = date.today().strftime('%Y-%m-%d')
	metrics = [ 'page_impressions', 'page_impressions_unique', 'page_engaged_users', 'page_follower_adds_unique', 'page_follower_removes_unique', 'page_actions_post_reactions_like_total', 'page_fan_adds', 'page_views_total', 'page_video_views', 'page_posts_impressions_unique',  ]
	results = lyf.fb_insights_query(metrics, 'day', since=today)

	for datum in results['data']:
		print '%s: %s' % (datum['title'], datum['values'][0]['value'])

if __name__ == '__main__':
	main()
