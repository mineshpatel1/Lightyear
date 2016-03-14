#! /usr/bin/env python
# LYF data integration function library

import lyf
import MySQLdb
import codecs

# MySQL database connection
def connect():
	mysql_user = lyf.get_config('MYSQL', 'Username')
	mysql_pw = lyf.get_config('MYSQL', 'Password')
	mysql_host = lyf.get_config('MYSQL', 'Hostname')
	mysql_db = lyf.get_config('MYSQL', 'Database')
	
	conn = MySQLdb.connect(host=mysql_host, user=mysql_user, passwd=mysql_pw, db=mysql_db, \
		charset='utf8', init_command='SET NAMES UTF8')
	return(conn)

# Insert row into table, updating on duplicate keys
def merge_into_table(db, table, row, keys):

	# UTF-8 encode all rows
	for col in row:
		row[col] = row[col].encode('utf-8')
	
	sql = 'INSERT INTO %s (\n' % table
	
	sql += ','.join(row.keys())
	sql += '\n) VALUES (\n'
	
	insert_values = []
	for col in row:
		insert_values.append("'%s'" % str(row[col]).replace("'","''"))
	sql += ','.join(insert_values)
	
	sql += ') ON DUPLICATE KEY UPDATE \n'
	
	update_values = []
	for col in row:
		if (col not in keys):
			update = '%s=%s' % (col, "'%s'" % str(row[col]).replace("'","''"))
			update_values.append(update)
			
	sql += ','.join(update_values)
	sql += ';'
	
	db.query(sql)
	db.commit()

# Truncate table
def truncate(db, table):
	sql = 'TRUNCATE TABLE %s;' % table
	db.query(sql)