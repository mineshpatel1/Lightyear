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
		prev_month = date.today() - timedelta(days=30)
		prev_month = prev_month.strftime('%Y-%m-%d')
		query += ',posts.since(%s){created_time,id,admin_creator,message}' % prev_month
	results = lyf.fb_query(query)
	print('Page Name: %s' % results['name'])
	print('Likes: %s' % results['likes'])
	print('Total Videos: %s' % len(results['videos']['data']))
	print('Total Posts: %s' % len(results['posts']['data']))

	totalVidLikes = 0
	for vid in results['videos']['data']:
		totalVidLikes += len(vid['likes']['data'])
	print('Total Video likes: %s' % totalVidLikes)

if __name__ == '__main__':
	main()
